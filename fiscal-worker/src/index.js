import { supabase } from './db.js';
import { executarComandoFiscal } from './fiscalLib.js';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Injeta a pasta das DLLs no PATH do sistema para o OpenSSL encontrar as dependências
const dllPath = path.resolve(__dirname, '../AcbrDLL/Windows/MT/Cdecl');
process.env.PATH = `${dllPath};${process.env.PATH}`;
console.log(`[Worker] PATH injetado com sucesso: ${dllPath}`);

// Configuração do Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level}: ${message}`;
        })
    ),
    transports: [new winston.transports.Console()]
});

logger.info("Iniciando Fiscal Worker...");

/**
 * Processa um evento que chegou na fila.
 * @param {object} evento - Registro da tabela fiscal_evento
 */
const processarEvento = async (evento) => {
    logger.info(`Recebido evento #${evento.id} | Comando: ${evento.comando} | Empresa: ${evento.empresa_id}`);
    
    try {
        // 1. Marca como PROCESSANDO
        const { error: updateError } = await supabase
            .from('fiscal_evento')
            .update({ status: 'PROCESSANDO', updated_at: new Date().toISOString() })
            .eq('id', evento.id)
            .eq('status', 'PENDENTE'); // Evita concorrencia (se outro worker ja pegou)

        if (updateError) throw updateError;

        // 2. Busca configuração fiscal se não vier completa no payload
        let payload = evento.payload || {};
        if (!payload.config || !payload.config.certificadoPath) {
            logger.info(`Buscando configurações fiscais para empresa ${evento.empresa_id}...`);
            const { data: configDb } = await supabase
                .from('fiscal_config')
                .select('*')
                .eq('empresa_id', evento.empresa_id)
                .maybeSingle();
            
            if (configDb) {
                payload.config = {
                    tipo_certificado: configDb.tipo_certificado || 'ARQUIVO',
                    certificadoPath: configDb.certificado,
                    certificadoSenha: configDb.senha_certificado ? Buffer.from(configDb.senha_certificado, 'base64').toString('ascii') : "",
                    ambiente: parseInt(configDb.ambiente_nfe || "2"),
                    uf: "SP", // Fallback, mas o ideal é vir no comando
                    modelo: 55
                };
                logger.info(`Configurações carregadas: Tipo=${payload.config.tipo_certificado}`);
                
                // Atualiza o registro do evento com o ambiente descoberto
                await supabase.from('fiscal_evento').update({ ambiente: payload.config.ambiente }).eq('id', evento.id);
            } else {
                logger.warn(`Empresa ${evento.empresa_id} não possui configurações fiscais cadastradas.`);
            }
        }

        // 3. Chama a biblioteca nativa passando o JSON payload atualizado
        const resultado = await executarComandoFiscal(evento.comando, payload);

        // 4. Salva o resultado (JSON) como string/jsonb no banco
        await supabase
            .from('fiscal_evento')
            .update({ 
                status: resultado.sucesso ? 'CONCLUIDO' : 'ERRO', 
                ambiente: payload.config?.ambiente, 
                resposta: JSON.stringify(resultado),
                mensagem_erro: resultado.sucesso ? null : (resultado.erro || "Falha na execução do comando"),
                updated_at: new Date().toISOString()
            })
            .eq('id', evento.id);

        // 5. Pós-processamento: atualizar fiscal_nfe_cabecalho se foi emissão de nota
        const isEmissao = ['EMITIR_NFE', 'EMITIR_NFCE'].includes(evento.comando);
        if (isEmissao && evento.referencia_id && evento.referencia_tabela === 'fiscal_nfe_cabecalho') {
            const stNf = resultado.sucesso ? 'A' : 'E'; // A=Autorizada, E=Erro
            const updateNfe = {
                c_stat:       resultado.c_stat || null,
                x_motivo:     resultado.x_motivo || (resultado.erro || null),
                chave_nfe:    resultado.chave_nfe || '',
                nr_protocolo: resultado.nr_protocolo || '',
                st_nf:        resultado.sucesso ? 'A' : 'R', // A=Autorizada, R=Rejeitada
            };
            if (resultado.xml_retorno) updateNfe.xml_nf = resultado.xml_retorno;
            
            const { error: errNfe } = await supabase
                .from('fiscal_nfe_cabecalho')
                .update(updateNfe)
                .eq('nfe_cabecalho_id', evento.referencia_id);
            
            if (errNfe) {
                logger.error(`Erro ao atualizar fiscal_nfe_cabecalho #${evento.referencia_id}: ${errNfe.message}`);
            } else {
                logger.info(`NF-e #${evento.referencia_id} atualizada: cStat=${resultado.c_stat} | Chave=${resultado.chave_nfe || 'N/A'}`);
            }
        }

        logger.info(`Evento #${evento.id} processado. Sucesso: ${resultado.sucesso}`);
        
    } catch (error) {
        logger.error(`Falha crítica ao processar evento #${evento.id}: ${error.message}`);
        
        await supabase
            .from('fiscal_evento')
            .update({ 
                status: 'ERRO', 
                mensagem_erro: "CRITICAL_ERROR: " + error.message,
                updated_at: new Date().toISOString()
            })
            .eq('id', evento.id);
    }
};

/**
 * Resgata eventos que possam ter ficado travados no banco e processa-os
 */
const recuperarPendentes = async () => {
    logger.info("Verificando eventos PENDENTES no banco de dados...");
    
    const { data: eventos, error } = await supabase
        .from('fiscal_evento')
        .select('*')
        .eq('status', 'PENDENTE')
        .order('created_at', { ascending: true });

    if (error) {
        logger.error("Erro ao buscar eventos pendentes: " + error.message);
        return;
    }

    if (eventos && eventos.length > 0) {
        logger.info(`Encontrados ${eventos.length} eventos pendentes. Iniciando processamento em lote...`);
        for (const evento of eventos) {
            await processarEvento(evento);
        }
    } else {
        logger.info("Nenhum evento pendente encontrado no momento.");
    }
};

/**
 * Inscreve no Supabase Realtime para ouvir novos inserts
 */
const iniciarEscutaRealtime = () => {
    logger.info("Conectando canal Realtime na tabela fiscal_evento...");
    
    supabase
        .channel('public:fiscal_evento')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'fiscal_evento',
            filter: "status=eq.PENDENTE" // Escuta apenas os pendentes novos
        }, (payload) => {
            logger.info("🔔 Novo evento realtime detectado!");
            processarEvento(payload.new);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.info("✅ Inscrito com sucesso no canal Realtime!");
            } else if (status === 'CHANNEL_ERROR') {
                logger.error("❌ Erro ao conectar no canal Realtime.");
            }
        });
};

// Fluxo Principal de Inicialização
const start = async () => {
    // Primeiro processa o que estiver parado
    await recuperarPendentes();
    
    // Depois inicia a escuta em tempo real
    iniciarEscutaRealtime();
};

start();

// Mantem o processo rodando e captura erros não tratados
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
