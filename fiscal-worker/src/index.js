import { supabase } from './db.js';
import { executarComandoFiscal } from './fiscalLib.js';
import { gerarIniNfe } from './gerarIniNfe.js';
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

const attachCidade = async (registro) => {
    if (!registro?.endereco_cidade_id) return registro;
    const { data: cidade } = await supabase
        .from('cidade')
        .select('*')
        .eq('cidade_id', registro.endereco_cidade_id)
        .maybeSingle();
    return { ...registro, cidade: cidade || null };
};

const decodeSenhaCertificado = (senha) => {
    if (!senha) return '';
    try {
        const decoded = Buffer.from(senha, 'base64').toString('utf8');
        const normalizada = Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/, '');
        return normalizada === String(senha).replace(/=+$/, '') ? decoded : senha;
    }
    catch { return senha; }
};

const montarPayloadEmissaoNfe = async (evento, payloadAtual) => {
    const nfeId = evento.nfe_cabecalho_id || evento.referencia_id;
    if (!nfeId) return payloadAtual;

    const { data: cab, error: cabErr } = await supabase
        .from('fiscal_nfe_cabecalho')
        .select('*')
        .eq('nfe_cabecalho_id', nfeId)
        .maybeSingle();
    if (cabErr || !cab) throw new Error(`NF-e/NFC-e #${nfeId} não localizada para emissão.`);

    const [{ data: empresaRaw }, { data: cadastroRaw }, { data: fiscalConfig }, { data: itens }, { data: pagamentos }, { data: configItens }] = await Promise.all([
        supabase.from('empresa').select('*').eq('empresa_id', cab.empresa_id).maybeSingle(),
        cab.cadastro_id ? supabase.from('cadastro').select('*').eq('cadastro_id', cab.cadastro_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('fiscal_config').select('*').eq('empresa_id', cab.empresa_id).maybeSingle(),
        supabase.from('fiscal_nfe_item').select('*').eq('nfe_cabecalho_id', nfeId).order('nr_item', { ascending: true }),
        supabase.from('fiscal_nfe_pagamento').select('*').eq('nfe_cabecalho_id', nfeId),
        supabase.from('fiscal_config_item').select('*').eq('empresa_id', cab.empresa_id),
    ]);

    if (!empresaRaw) throw new Error(`Empresa #${cab.empresa_id} não localizada para emissão.`);
    if (!fiscalConfig) throw new Error(`Configuração fiscal da empresa #${cab.empresa_id} não localizada.`);

    const configItem = (configItens || []).find(ci => String(ci.modelo) === String(cab.modelo) && Number(ci.serie) === Number(cab.serie))
        || (configItens || []).find(ci => String(ci.modelo) === String(cab.modelo));
    if (!configItem) throw new Error(`Item de configuração fiscal modelo ${cab.modelo}/série ${cab.serie} não localizado.`);

    const empresa = await attachCidade(empresaRaw);
    const cadastro = await attachCidade(cadastroRaw);
    const iniContent = gerarIniNfe({ cabecalho: cab, itens: itens || [], pagamentos: pagamentos || [], empresa, cadastro, fiscalConfig, configItem });
    const isNfce = String(cab.modelo) === '65' || evento.comando === 'EMITIR_NFCE';

    return {
        ...payloadAtual,
        dados: iniContent,
        config: {
            ...(payloadAtual.config || {}),
            uf: empresa.cidade?.estado_id || payloadAtual.config?.uf || 'SP',
            modelo: Number(cab.modelo),
            ambiente: Number(fiscalConfig.ambiente_nfe || payloadAtual.config?.ambiente || 2),
            certificadoPath: fiscalConfig.certificado,
            certificadoSenha: decodeSenhaCertificado(fiscalConfig.senha_certificado),
            tipo_certificado: fiscalConfig.tipo_certificado || payloadAtual.config?.tipo_certificado || 'ARQUIVO',
            csc: configItem.csc || payloadAtual.config?.csc || '',
            id_csc: configItem.id_csc || payloadAtual.config?.id_csc || '',
        },
        print_config: payloadAtual.print_config || {
            tp_imp: isNfce ? (configItem.tp_imp_nfce || 'PDF') : (configItem.tp_imp_nfe || 'PDF'),
            nm_impressora: isNfce ? (configItem.nm_impressora_nfce || '') : (configItem.nm_impressora_nfe || ''),
        },
    };
};

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

        const isEmissao = ['EMITIR_NFE', 'EMITIR_NFCE'].includes(evento.comando);
        if (isEmissao) {
            payload = await montarPayloadEmissaoNfe(evento, payload);
            logger.info(`Payload de emissão regenerado pelo worker: ${payload.dados.substring(0, 40).replace(/\r?\n/g, ' ')}...`);
            await supabase
                .from('fiscal_evento')
                .update({ payload, ambiente: payload.config?.ambiente || evento.ambiente })
                .eq('id', evento.id);
        }

        // 2.b Buscar config de impressão (tp_imp_*, nm_impressora_*) baseado no documento referenciado
        if (isEmissao && (evento.nfe_cabecalho_id || evento.referencia_id) && !payload.print_config) {
            try {
                const nfeId = evento.nfe_cabecalho_id || evento.referencia_id;
                const { data: nfe } = await supabase
                    .from('fiscal_nfe_cabecalho')
                    .select('modelo, serie, empresa_id')
                    .eq('nfe_cabecalho_id', nfeId)
                    .maybeSingle();
                if (nfe) {
                    const { data: ci } = await supabase
                        .from('fiscal_config_item')
                        .select('tp_imp_nfe, tp_imp_nfce, nm_impressora_nfe, nm_impressora_nfce')
                        .eq('empresa_id', nfe.empresa_id)
                        .eq('modelo', String(nfe.modelo))
                        .eq('serie', String(nfe.serie))
                        .maybeSingle();
                    if (ci) {
                        const isNfce = String(nfe.modelo) === '65' || evento.comando === 'EMITIR_NFCE';
                        payload.print_config = {
                            tp_imp: isNfce ? (ci.tp_imp_nfce || 'PDF') : (ci.tp_imp_nfe || 'PDF'),
                            nm_impressora: isNfce ? (ci.nm_impressora_nfce || '') : (ci.nm_impressora_nfe || '')
                        };
                        logger.info(`Config de impressão: tp_imp=${payload.print_config.tp_imp} impressora=${payload.print_config.nm_impressora}`);
                    }
                }
            } catch (e) {
                logger.warn(`Falha ao buscar config de impressão: ${e.message}`);
            }
        }

        // 3. Chama a biblioteca nativa passando o JSON payload atualizado
        const resultado = await executarComandoFiscal(evento.comando, payload);

        // 4. PRIMEIRO: atualizar fiscal_nfe_cabecalho se foi emissão (antes do evento, para garantir consistência)
        const nfeCabecalhoId = evento.nfe_cabecalho_id || evento.referencia_id;
        if (isEmissao && nfeCabecalhoId) {
            const cStatInt = resultado.c_stat != null && !isNaN(parseInt(resultado.c_stat))
                ? parseInt(resultado.c_stat) : null;
            const updateNfe = {
                c_stat:       cStatInt,
                x_motivo:     (resultado.x_motivo || resultado.erro || '').toString().substring(0, 255),
                chave_nfe:    resultado.chave_nfe || '',
                nr_protocolo: resultado.nr_protocolo || '',
                recibo_sefaz: resultado.recibo_sefaz || '',
                st_nf:        resultado.sucesso ? 'E' : 'R', // E=Emitida/Autorizada, R=Rejeitada
                updated_at:   new Date().toISOString(),
            };
            if (resultado.xml_retorno) updateNfe.xml_nf = resultado.xml_retorno;

            const { data: updRows, error: errNfe } = await supabase
                .from('fiscal_nfe_cabecalho')
                .update(updateNfe)
                .eq('nfe_cabecalho_id', nfeCabecalhoId)
                .select('nfe_cabecalho_id, chave_nfe, c_stat, st_nf');

            if (errNfe) {
                logger.error(`Erro ao atualizar fiscal_nfe_cabecalho #${nfeCabecalhoId}: ${errNfe.message}`);
            } else if (!updRows || updRows.length === 0) {
                logger.error(`UPDATE fiscal_nfe_cabecalho #${nfeCabecalhoId} retornou 0 linhas. Verifique RLS/ID.`);
            } else {
                logger.info(`NF-e #${nfeCabecalhoId} atualizada: cStat=${resultado.c_stat} | Chave=${resultado.chave_nfe || 'N/A'} | st_nf=${updRows[0].st_nf}`);
            }
        }

        // 5. Salva o resultado (JSON) e marca status final do evento.
        // EMITIDO = autorizado pela SEFAZ; ERRO = rejeitado/falha; CONCLUIDO mantido apenas legado.
        const statusFinal = resultado.sucesso ? 'EMITIDO' : 'ERRO';
        const { error: errEv } = await supabase
            .from('fiscal_evento')
            .update({
                status: statusFinal,
                ambiente: payload.config?.ambiente,
                resposta: JSON.stringify(resultado),
                mensagem_erro: resultado.sucesso ? null : (resultado.erro || "Falha na execução do comando"),
                updated_at: new Date().toISOString()
            })
            .eq('id', evento.id);
        if (errEv) logger.error(`Erro ao atualizar fiscal_evento #${evento.id}: ${errEv.message}`);

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
