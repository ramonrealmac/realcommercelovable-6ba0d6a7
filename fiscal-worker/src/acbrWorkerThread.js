import koffi from 'koffi';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { parentPort, workerData } from 'worker_threads';
import crypto from 'crypto';

// Adicionar as pastas de dependências (OpenSSL e LibXml2) ao PATH do Windows dinamicamente
const depPaths = [
    path.resolve(process.cwd(), 'AcbrDLL/dep/OpenSSL/x64'),
    path.resolve(process.cwd(), 'AcbrDLL/dep/LibXml2/x64')
];
process.env.PATH = depPaths.join(path.delimiter) + path.delimiter + process.env.PATH;

dotenv.config();

const nfeLibPath = process.env.FISCAL_LIB_PATH;
const mdfeLibPath = process.env.FISCAL_MDFE_LIB_PATH;

let libNFe = null;
let libMDFe = null;

// Tipos Koffi
const handleType = koffi.pointer('void');
const handlePtrType = koffi.out(koffi.pointer('void'));
const stringOutType = koffi.out('char *');
const intOutType = koffi.out('int *');

const TAMANHO_BUFFER = 1024 * 1024; // 1MB para suportar grandes retornos de DFe

const loadLibrary = (path, prefix) => {
    if (path && fs.existsSync(path)) {
        try {
            const lib = koffi.load(path);
            console.log(`[FiscalLib] Biblioteca ${prefix} carregada de: ${path}`);
            
            // Funções Comuns a todas as Libs ACBr
            const funcoes = {
                Inicializar: lib.func('int __cdecl ' + prefix + '_Inicializar(_Out_ void **handle, const char* eArqConfig, const char* eChaveCrypt)'),
                Finalizar: lib.func('int __cdecl ' + prefix + '_Finalizar(void* handle)'),
                UltimoRetorno: lib.func('int __cdecl ' + prefix + '_UltimoRetorno(void* handle, _Out_ char* sMensagem, _Out_ int* esTamanho)'),
                ConfigGravarValor: lib.func('int __cdecl ' + prefix + '_ConfigGravarValor(void* handle, const char* eSessao, const char* eChave, const char* eValor)'),
                CarregarINI: lib.func('int __cdecl ' + prefix + '_CarregarINI(void* handle, const char* eArquivoOuINI)'),
                CarregarXML: lib.func('int __cdecl ' + prefix + '_CarregarXML(void* handle, const char* eArquivoOuXML)'),
                LimparLista: lib.func('int __cdecl ' + prefix + '_LimparLista(void* handle)'),
                Enviar: lib.func('int __cdecl ' + prefix + '_Enviar(void* handle, int ALote, bool Imprimir, bool Sincrono, bool Zipado, _Out_ char* sResposta, _Out_ int* esTamanho)'),
                ObterXml: lib.func('int __cdecl ' + prefix + '_ObterXml(void* handle, int AIndex, _Out_ char* sResposta, _Out_ int* esTamanho)'),
                LimparListaEventos: lib.func('int __cdecl ' + prefix + '_LimparListaEventos(void* handle)'),
                CarregarEventoINI: lib.func('int __cdecl ' + prefix + '_CarregarEventoINI(void* handle, const char* eArquivoOuINI)'),
                EnviarEvento: lib.func('int __cdecl ' + prefix + '_EnviarEvento(void* handle, int idLote, _Out_ char* sResposta, _Out_ int* esTamanho)'),
                Cancelar: lib.func('int __cdecl ' + prefix + '_Cancelar(void* handle, const char* eChave, const char* eJustificativa, const char* eCNPJ, int ALote, _Out_ char* sResposta, _Out_ int* esTamanho)'),
                StatusServico: lib.func('int __cdecl ' + prefix + '_StatusServico(void* handle, _Out_ char* sResposta, _Out_ int* esTamanho)')
            };

            // Funções de impressão (apenas NFe/NFCe)
            if (prefix === 'NFE') {
                try {
                    funcoes.ImprimirDANFEPDF = lib.func('int __cdecl NFE_ImprimirDANFEPDF(void* handle)');
                } catch (e) { console.warn('[FiscalLib] ImprimirDANFEPDF indisponível:', e.message); }
                try {
                    funcoes.ImprimirDANFE = lib.func('int __cdecl NFE_ImprimirDANFE(void* handle, const char* eArquivoXml, const char* eImpressora, int nCopias, const char* eProtocolo, bool bMostrarPreview, const char* eMarcaDagua, bool bViaConsumidor)');
                } catch (e) { console.warn('[FiscalLib] ImprimirDANFE indisponível:', e.message); }
            }

            // Funções específicas da NFe
            // IMPORTANTE: A DLL não tem NFE_DistribuicaoDFe genérica!
            // As funções corretas são as três variantes abaixo, com AcUFAutor como INT.
            // Referência oficial: github.com/Projeto-ACBr-Oficial/ACBrLib-Nodejs
            if (prefix === 'NFE') {
                try {
                    funcoes.DistribuicaoDFePorUltNSU = lib.func('int __cdecl NFE_DistribuicaoDFePorUltNSU(void* handle, int AcUFAutor, const char* eCNPJCPF, const char* eultNSU, _Out_ char* sResposta, _Out_ int* esTamanho)');
                    funcoes.DistribuicaoDFePorNSU = lib.func('int __cdecl NFE_DistribuicaoDFePorNSU(void* handle, int AcUFAutor, const char* eCNPJCPF, const char* eNSU, _Out_ char* sResposta, _Out_ int* esTamanho)');
                    funcoes.DistribuicaoDFePorChave = lib.func('int __cdecl NFE_DistribuicaoDFePorChave(void* handle, int AcUFAutor, const char* eCNPJCPF, const char* eChave, _Out_ char* sResposta, _Out_ int* esTamanho)');
                    console.log('[FiscalLib] Funções DistribuicaoDFe carregadas com sucesso.');
                } catch (e) {
                    console.warn('[FiscalLib] Aviso: Funções de Distribuição NFe não encontradas na DLL:', e.message);
                }
            }

            return funcoes;
        } catch (error) {
            console.error(`[FiscalLib] Erro ao carregar a DLL ${prefix}: ${error.message}`);
        }
    } else {
        console.warn(`[FiscalLib] AVISO: Caminho para a DLL ${prefix} não encontrado ou arquivo inexistente.`);
    }
    return null;
};

libNFe = loadLibrary(nfeLibPath, 'NFE');
libMDFe = loadLibrary(mdfeLibPath, 'MDFE');

/**
 * Lê o retorno estendido do ACBrLib quando uma função falha ou retorna dados.
 */
const lerRetornoACBr = (lib, handle) => {
    const bufferTamanho = Buffer.alloc(4);
    bufferTamanho.writeInt32LE(9999, 0); // Tamanho inicial alocado
    const bufferMensagem = Buffer.alloc(9999);
    
    lib.UltimoRetorno(handle, bufferMensagem, bufferTamanho);
    
    let tamanhoReal = bufferTamanho.readInt32LE(0);
    if (tamanhoReal < 0 || tamanhoReal > 9999) tamanhoReal = 9999;
    return bufferMensagem.toString('utf8', 0, tamanhoReal).replace(/\0/g, '');
};

/**
 * Extrai dados estruturados do retorno textual do ACBr (INI ou XML parcial).
 * Retorna: { chave_nfe, nr_protocolo, c_stat, x_motivo }
 */
const parsearRetornoNfe = (retorno) => {
    if (!retorno) return { chave_nfe: null, nr_protocolo: null, c_stat: null, x_motivo: null, recibo_sefaz: null };
    
    const extrair = (chave) => {
        const regex = new RegExp(`${chave}[=:]\\s*"?([^\\r\\n",}]+)"?`, 'i');
        const m = retorno.match(regex);
        return m ? m[1].trim() : null;
    };

    let c_stat    = extrair('cStat') || extrair('CStat');
    let x_motivo  = extrair('xMotivo') || extrair('XMotivo');
    let chave_nfe = extrair('chNFe') || extrair('ChNFe') || extrair('ChaveNFe');
    let nr_prot   = extrair('nProt') || extrair('NProt') || extrair('Protocolo');
    let recibo    = extrair('nRec') || extrair('NRec') || extrair('Recibo');

    if (!chave_nfe) {
        const mChave = retorno.match(/chNFe="([^"]{44})"/i) || retorno.match(/<chNFe>([^<]{44})<\/chNFe>/i);
        if (mChave) chave_nfe = mChave[1];
    }
    if (!nr_prot) {
        const mProt = retorno.match(/nProt="([^"]+)"/i) || retorno.match(/<nProt>([^<]+)<\/nProt>/i);
        if (mProt) nr_prot = mProt[1];
    }
    if (!c_stat) {
        const mStat = retorno.match(/cStat="([^"]+)"/i) || retorno.match(/<cStat>([^<]+)<\/cStat>/i);
        if (mStat) c_stat = mStat[1];
    }
    if (!x_motivo) {
        const mMot = retorno.match(/xMotivo="([^"]+)"/i) || retorno.match(/<xMotivo>([^<]+)<\/xMotivo>/i);
        if (mMot) x_motivo = mMot[1];
    }
    if (!recibo) {
        const mRec = retorno.match(/nRec="([^"]+)"/i) || retorno.match(/<nRec>([^<]+)<\/nRec>/i);
        if (mRec) recibo = mRec[1];
    }

    return { chave_nfe, nr_protocolo: nr_prot, c_stat, x_motivo, recibo_sefaz: recibo };
};

/**
 * Tenta imprimir DANFE/DANFCE baseado em print_config { tp_imp, nm_impressora }.
 * Retorna um objeto de resultado e nunca propaga erro para o fluxo fiscal.
 */
const tentarImprimirDANFE = (lib, handle, printConfig, modeloLabel, chave) => {
    if (!printConfig) return { sucesso: true, ignorado: true, pdf_path: null };
    const tp = (printConfig.tp_imp || 'PDF').toUpperCase();
    if (tp === 'NAO_IMPRIME' || tp === 'NAO IMPRIME' || tp === 'NONE') return { sucesso: true, ignorado: true, pdf_path: null };
    
    try {
        if (tp === 'IMPRESSORA' && printConfig.nm_impressora) {
            lib.ConfigGravarValor(handle, "DANFe", "Impressora", printConfig.nm_impressora);
        }
        const pdfDir = path.resolve(process.cwd(), "AcbrDLL/Arquivos/PDF");
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
        lib.ConfigGravarValor(handle, "DANFe", "PathPDF", pdfDir);
        lib.ConfigGravarValor(handle, "DANFe", "MostraPreview", "0");
        lib.ConfigGravarValor(handle, "DANFe", "MostraStatus", "0");
        
        if (tp === 'PDF' && lib.ImprimirDANFEPDF) {
            const ret = lib.ImprimirDANFEPDF(handle);
            console.log(`[FiscalLib] ImprimirDANFEPDF (${modeloLabel}) ret=${ret}`);
            if (ret !== 0) return { sucesso: false, erro: lerRetornoACBr(lib, handle) || `ImprimirDANFEPDF retornou ${ret}`, pdf_path: null };
            const pdf = chave ? path.join(pdfDir, `${chave}-procNFe.pdf`) : null;
            return { sucesso: true, pdf_path: pdf && fs.existsSync(pdf) ? pdf : pdfDir };
        } else if (tp === 'IMPRESSORA' && lib.ImprimirDANFE) {
            const ret = lib.ImprimirDANFE(handle, "", printConfig.nm_impressora || "", 1, "", false, "", false);
            console.log(`[FiscalLib] ImprimirDANFE (${modeloLabel}) impressora=${printConfig.nm_impressora} ret=${ret}`);
            if (ret !== 0) return { sucesso: false, erro: lerRetornoACBr(lib, handle) || `ImprimirDANFE retornou ${ret}`, pdf_path: null };
            return { sucesso: true, pdf_path: null };
        }
        return { sucesso: false, erro: `Tipo de impressão ${tp} sem função disponível na ACBrLib.`, pdf_path: null };
    } catch (e) {
        console.warn(`[FiscalLib] Falha ao imprimir DANFE/DANFCE: ${e.message}`);
        return { sucesso: false, erro: e.message, pdf_path: null };
    }
};

const configurarHandle = (lib, handle, configPayload) => {
    // Configuração dos Schemas XSD (Obrigatório para NFe/MDFe)
    const schemasPath = path.resolve(process.cwd(), "AcbrDLL/dep/Schemas/NFe");
    lib.ConfigGravarValor(handle, "NFe", "PathSchemas", schemasPath);
    // Resposta em JSON (TipoResposta=2) — essencial, antes vinha só do INI
    lib.ConfigGravarValor(handle, "Principal", "TipoResposta", "2");      // 0=string, 1=XML, 2=JSON
    lib.ConfigGravarValor(handle, "Principal", "CodificacaoResposta", "0"); // 0=UTF-8

    // Caminhos de Arquivos e Logs
    const baseArquivos = path.resolve(process.cwd(), "AcbrDLL/Arquivos");
    lib.ConfigGravarValor(handle, "NFe", "PathSalvar", baseArquivos);
    lib.ConfigGravarValor(handle, "NFe", "PathNFe", path.join(baseArquivos, "NFe"));
    lib.ConfigGravarValor(handle, "NFe", "PathInu", path.join(baseArquivos, "Inu"));
    lib.ConfigGravarValor(handle, "NFe", "PathEvento", path.join(baseArquivos, "Evento"));
    lib.ConfigGravarValor(handle, "Principal", "LogPath", path.resolve(process.cwd(), "AcbrDLL/log"));

    if (!configPayload) return;
    
    // Configuração do Certificado (Híbrido: Arquivo vs Repositório)
    const tipoCertificado = configPayload.tipo_certificado || 'ARQUIVO';
    
    if (tipoCertificado === 'REPOSITORIO') {
        // Usa Repositório do Windows (WinCrypt/WinHttp) - ideal para certificados A3 em HSM/Token
        lib.ConfigGravarValor(handle, "DFe", "SSLLib", "4");         // 4=libWinCrypt (SChannel/WinCrypt)
        lib.ConfigGravarValor(handle, "DFe", "SSLCryptLib", "3");   // 3=cryWinCrypt
        lib.ConfigGravarValor(handle, "DFe", "SSLHttpLib", "2");    // 2=httpWinHttp
        lib.ConfigGravarValor(handle, "DFe", "SSLXmlSignLib", "4"); // 4=xsLibXml2 (enum ACBrLib atual: 0=None,1=XmlSec,2=MsXml,3=MsXmlCapicom,4=LibXml2)
        
        if (configPayload.certificadoPath) { 
            lib.ConfigGravarValor(handle, "DFe", "NumeroSerie", configPayload.certificadoPath);
            lib.ConfigGravarValor(handle, "DFe", "ArquivoPFX", "");
            lib.ConfigGravarValor(handle, "DFe", "Senha", "");
        }
    } else {
        // Usa Arquivo PFX com OpenSSL - motor padrão para certificados A1 em arquivo
        lib.ConfigGravarValor(handle, "DFe", "SSLLib", "1");        // 1=libOpenSSL
        lib.ConfigGravarValor(handle, "DFe", "SSLCryptLib", "1");   // 1=cryOpenSSL
        lib.ConfigGravarValor(handle, "DFe", "SSLHttpLib", "3");    // 3=httpOpenSSL
        lib.ConfigGravarValor(handle, "DFe", "SSLXmlSignLib", "4"); // 4=xsLibXml2 (a opção implementada na compilação padrão da ACBrLib)
        
        if (configPayload.certificadoPath) {
            lib.ConfigGravarValor(handle, "DFe", "ArquivoPFX", configPayload.certificadoPath);
            lib.ConfigGravarValor(handle, "DFe", "Senha", configPayload.certificadoSenha || "");
            lib.ConfigGravarValor(handle, "DFe", "NumeroSerie", "");
        }
    }

    if (configPayload.uf) lib.ConfigGravarValor(handle, "DFe", "UF", configPayload.uf);
    // Ambiente: definido em AMBAS as seções pois o serviço DistribuicaoDFe pode ler de qualquer uma
    if (configPayload.ambiente) {
        // SEFAZ/Banco: 1 = Produção, 2 = Homologação
        // ACBrLib (TACBrAmbiente): 0 = taProducao, 1 = taHomologacao
        const ambACBr = configPayload.ambiente.toString() === '1' ? '0' : '1';
        
        lib.ConfigGravarValor(handle, "NFe", "Ambiente", ambACBr);
        lib.ConfigGravarValor(handle, "DFe", "Ambiente", ambACBr);
        console.log(`[FiscalLib] Ambiente configurado: ${ambACBr === '0' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}`);
    }
    // REMOVIDO: ModeloDF não deve ser escrito via configPayload.modelo (seria 55/65 = código do modelo NF-e)
    // O DLL espera ordinal TACBrMod: 0=NFe, 1=NFCe — e o padrão 0 do INI já é correto
    if (configPayload.cnpj) lib.ConfigGravarValor(handle, "Emitente", "CNPJ", configPayload.cnpj);
    
    // Versão do schema de Distribuição DFe (não sobrescreve SSL definido acima)
    lib.ConfigGravarValor(handle, "DFe", "VersaoDistribuicaoDFe", "1.01");
    
    // Desativar logs de envio para evitar Access Violation por permissão de pasta
    lib.ConfigGravarValor(handle, "Principal", "LogNivel", "0");
    lib.ConfigGravarValor(handle, "NFe", "SalvarGer", "0");
    lib.ConfigGravarValor(handle, "NFe", "SalvarArq", "0");
};

/**
 * Função utilitária para chamar a DLL isolada por requisição (Multi-Thread)
 */
const executarNaDLL = async (lib, configPayload, callbackExecucao) => {
    if (!lib) throw new Error("A DLL nativa não está carregada no ambiente.");
    
    // 1. Instanciar o Handle isolado com um INI único por thread para evitar corrupção de concorrência
    const handlePtr = [null];
    const baseIni = path.resolve(process.cwd(), "ACBrNFe.ini");
    const uniqueId = crypto.randomUUID();
    const threadIni = path.resolve(process.cwd(), `ACBrNFe_Thread_${uniqueId}.ini`);
    
    try {
        if (fs.existsSync(baseIni)) {
            fs.copyFileSync(baseIni, threadIni);
        } else {
            fs.writeFileSync(threadIni, "");
        }
    } catch (e) {
        console.warn(`[FiscalLib Worker] Aviso: Não foi possível preparar o INI temporário: ${e.message}`);
    }

    const retInit = lib.Inicializar(handlePtr, threadIni, "");
    if (retInit !== 0) {
        let erroDetalhado = "Erro desconhecido";
        if (handlePtr[0]) {
            try { erroDetalhado = lerRetornoACBr(lib, handlePtr[0]); } catch(e) {}
        }
        try { if (fs.existsSync(threadIni)) fs.unlinkSync(threadIni); } catch(e) {}
        throw new Error("Falha ao inicializar a ACBrLib (Handle MT). Retorno: " + retInit + " | Detalhe: " + erroDetalhado);
    }
    
    const handle = handlePtr[0];
    
    try {
        // 2. Configurar o Emitente dinamicamente
        configurarHandle(lib, handle, configPayload);
        
        // 3. Executar o fluxo da nota solicitado
        return await callbackExecucao(handle);
        
    } finally {
        // 4. Sempre finalizar e destruir o Handle na memória e apagar o INI temporário
        if (handle) lib.Finalizar(handle);
        try {
            if (fs.existsSync(threadIni)) {
                fs.unlinkSync(threadIni);
            }
        } catch (e) {
            console.error(`[FiscalLib Worker] Falha ao excluir INI temporário ${threadIni}: ${e.message}`);
        }
    }
};

/**
 * Função principal para invocar comandos na biblioteca local.
 */
const executarComandoFiscal = async (comando, jsonPayload) => {
    const config = jsonPayload.config || {};
    const dados = jsonPayload.dados || ""; // String INI ou XML
    
    console.log(`[FiscalLib] Executando comando: ${comando}...`);
    
    switch (comando) {
        case 'EMITIR_NFE':
            config.modelo = 55;
            return executarNaDLL(libNFe, config, async (handle) => {
                libNFe.LimparLista(handle);
                
                const iniContent = typeof jsonPayload.dados === 'string' ? jsonPayload.dados : JSON.stringify(jsonPayload.dados);
                console.log(`[FiscalLib] CarregarINI NFe (${iniContent.length} chars)...`);
                
                let ret = libNFe.CarregarINI(handle, iniContent);
                if (ret !== 0) throw new Error('[NFE] CarregarINI: ' + lerRetornoACBr(libNFe, handle));
                
                const bufferResposta = Buffer.alloc(TAMANHO_BUFFER);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(TAMANHO_BUFFER, 0);
                
                ret = libNFe.Enviar(handle, 1, false, true, false, bufferResposta, bufferTamanho);
                const ultimoRetorno = lerRetornoACBr(libNFe, handle);
                const tamanho = bufferTamanho.readInt32LE(0);
                const xmlRetorno = tamanho > 0 && tamanho !== TAMANHO_BUFFER
                    ? bufferResposta.toString('utf8', 0, tamanho)
                    : '';
                
                console.log(`[FiscalLib] Enviar NFe ret=${ret} | UltimoRetorno: ${ultimoRetorno.substring(0, 200)}`);
                
                const parsed = parsearRetornoNfe(ultimoRetorno || xmlRetorno);
                const sucesso = parsed.c_stat === '100';
                
                // Após sucesso, recuperar o XML assinado da NFe (procNFe completo) via ObterXml(0)
                let xml_nfe = '';
                if (sucesso) {
                    try {
                        const bufXml = Buffer.alloc(TAMANHO_BUFFER);
                        const bufXmlTam = Buffer.alloc(4);
                        bufXmlTam.writeInt32LE(TAMANHO_BUFFER, 0);
                        const retXml = libNFe.ObterXml(handle, 0, bufXml, bufXmlTam);
                        if (retXml === 0) {
                            const tamXml = bufXmlTam.readInt32LE(0);
                            if (tamXml > 0 && tamXml <= TAMANHO_BUFFER) {
                                xml_nfe = bufXml.toString('utf8', 0, tamXml).replace(/\0/g, '');
                            }
                        } else {
                            console.warn(`[FiscalLib] ObterXml NFe ret=${retXml} | ${lerRetornoACBr(libNFe, handle)}`);
                        }
                    } catch (e) { console.warn('[FiscalLib] Falha ObterXml NFe:', e.message); }
                }

                // Após sucesso, tentar imprimir DANFE conforme tp_imp_nfe configurado.
                // Erro de impressão não pode invalidar autorização/salvamento da nota.
                let impressao = { sucesso: true, pdf_path: null };
                if (sucesso) {
                    impressao = tentarImprimirDANFE(libNFe, handle, jsonPayload.print_config, 'NFE', parsed.chave_nfe);
                }
                
                return { 
                    sucesso,
                    chave_nfe: parsed.chave_nfe,
                    nr_protocolo: parsed.nr_protocolo,
                    c_stat: parsed.c_stat,
                    x_motivo: parsed.x_motivo,
                    recibo_sefaz: parsed.recibo_sefaz,
                    xml_nfe,
                    xml_retorno: xmlRetorno,
                    retorno_completo: ultimoRetorno || xmlRetorno,
                    pdf_path: impressao.pdf_path,
                    impressao,
                    erro: sucesso ? null : (parsed.x_motivo || ultimoRetorno)
                };
            });

        case 'EMITIR_NFCE':
            config.modelo = 65;
            return executarNaDLL(libNFe, config, async (handle) => {
                libNFe.LimparLista(handle);
                
                const iniContent = typeof jsonPayload.dados === 'string' ? jsonPayload.dados : JSON.stringify(jsonPayload.dados);
                console.log(`[FiscalLib] CarregarINI NFCe (${iniContent.length} chars)...`);
                
                let ret = libNFe.CarregarINI(handle, iniContent);
                if (ret !== 0) throw new Error('[NFCe] CarregarINI: ' + lerRetornoACBr(libNFe, handle));
                
                const bufferResposta = Buffer.alloc(TAMANHO_BUFFER);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(TAMANHO_BUFFER, 0);
                
                ret = libNFe.Enviar(handle, 1, false, true, false, bufferResposta, bufferTamanho);
                const ultimoRetorno = lerRetornoACBr(libNFe, handle);
                const tamanho = bufferTamanho.readInt32LE(0);
                const xmlRetorno = tamanho > 0 && tamanho !== TAMANHO_BUFFER
                    ? bufferResposta.toString('utf8', 0, tamanho)
                    : '';
                
                console.log(`[FiscalLib] Enviar NFCe ret=${ret} | UltimoRetorno: ${ultimoRetorno.substring(0, 200)}`);
                
                const parsed = parsearRetornoNfe(ultimoRetorno || xmlRetorno);
                const sucesso = parsed.c_stat === '100';
                
                // Após sucesso, recuperar o XML assinado da NFCe (procNFe completo) via ObterXml(0)
                let xml_nfe = '';
                if (sucesso) {
                    try {
                        const bufXml = Buffer.alloc(TAMANHO_BUFFER);
                        const bufXmlTam = Buffer.alloc(4);
                        bufXmlTam.writeInt32LE(TAMANHO_BUFFER, 0);
                        const retXml = libNFe.ObterXml(handle, 0, bufXml, bufXmlTam);
                        if (retXml === 0) {
                            const tamXml = bufXmlTam.readInt32LE(0);
                            if (tamXml > 0 && tamXml <= TAMANHO_BUFFER) {
                                xml_nfe = bufXml.toString('utf8', 0, tamXml).replace(/\0/g, '');
                            }
                        } else {
                            console.warn(`[FiscalLib] ObterXml NFCe ret=${retXml} | ${lerRetornoACBr(libNFe, handle)}`);
                        }
                    } catch (e) { console.warn('[FiscalLib] Falha ObterXml NFCe:', e.message); }
                }

                // Após sucesso, tentar imprimir DANFCE conforme tp_imp_nfce configurado.
                // Erro de impressão não pode invalidar autorização/salvamento da nota.
                let impressao = { sucesso: true, pdf_path: null };
                if (sucesso) {
                    impressao = tentarImprimirDANFE(libNFe, handle, jsonPayload.print_config, 'NFCE', parsed.chave_nfe);
                }
                
                return { 
                    sucesso,
                    chave_nfe: parsed.chave_nfe,
                    nr_protocolo: parsed.nr_protocolo,
                    c_stat: parsed.c_stat,
                    x_motivo: parsed.x_motivo,
                    recibo_sefaz: parsed.recibo_sefaz,
                    xml_nfe,
                    xml_retorno: xmlRetorno,
                    retorno_completo: ultimoRetorno || xmlRetorno,
                    pdf_path: impressao.pdf_path,
                    impressao,
                    erro: sucesso ? null : (parsed.x_motivo || ultimoRetorno)
                };
            });

        case 'EMITIR_MDFE':
            return executarNaDLL(libMDFe, config, async (handle) => {
                libMDFe.LimparLista(handle);
                let ret = libMDFe.CarregarINI(handle, dados);
                if (ret !== 0) throw new Error(lerRetornoACBr(libMDFe, handle));
                
                const bufferResposta = Buffer.alloc(9999);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(9999, 0);
                
                ret = libMDFe.Enviar(handle, 1, false, true, false, bufferResposta, bufferTamanho);
                if (ret !== 0) throw new Error(lerRetornoACBr(libMDFe, handle));
                
                return { sucesso: true, xml_retorno: bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0)) };
            });

        case 'CANCELAR_NFE':
        case 'CANCELAR_NFCE':
            // O payload deve conter: chave, justificativa, cnpj
            return executarNaDLL(libNFe, config, async (handle) => {
                const bufferResposta = Buffer.alloc(9999);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(9999, 0);
                
                const { chave, justificativa, cnpj } = jsonPayload;
                const ret = libNFe.Cancelar(handle, chave, justificativa, cnpj, 1, bufferResposta, bufferTamanho);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                return { sucesso: true, cancelamento_retorno: bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0)) };
            });

        case 'MANIFESTAR_NFE':
            return executarNaDLL(libNFe, config, async (handle) => {
                libNFe.LimparListaEventos(handle);
                let ret = libNFe.CarregarEventoINI(handle, dados);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                const bufferResposta = Buffer.alloc(9999);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(9999, 0);
                
                ret = libNFe.EnviarEvento(handle, 1, bufferResposta, bufferTamanho);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                return { sucesso: true, manifestacao_retorno: bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0)) };
            });

        case 'IMPORTAR_XML_NFE':
            // Para casos de leitura e recuperação das tags do XML
            return executarNaDLL(libNFe, config, async (handle) => {
                let ret = libNFe.CarregarXML(handle, dados); // Pode ser um path ou string XML
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                const bufferResposta = Buffer.alloc(99999); // Buffer maior para XML
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(99999, 0);
                
                ret = libNFe.ObterXml(handle, 0, bufferResposta, bufferTamanho); // Pega o index 0
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                return { sucesso: true, xml: bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0)) };
            });

        case 'STATUS_SERVICO':
            return executarNaDLL(libNFe, config, async (handle) => {
                const bufferResposta = Buffer.alloc(9999);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(9999, 0);
                
                let ret = libNFe.StatusServico(handle, bufferResposta, bufferTamanho);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                return { sucesso: true, status_retorno: bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0)) };
            });

        // Alias legado (eventos já gravados no banco antes da renomeação)
        case 'NFE.DistribuicaoDFe':
        case 'NFE.DistribuicaoDFePorUltNSU': {
            // Chama NFE_DistribuicaoDFePorUltNSU — a função real da DLL
            return executarNaDLL(libNFe, config, async (handle) => {
                const bufferResposta = Buffer.alloc(TAMANHO_BUFFER);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(TAMANHO_BUFFER, 0);

                // Extrai parâmetros do campo comando_full (ambos os formatos suportados)
                // NFE.DistribuicaoDFePorUltNSU(UF, "CNPJ", "NSU") ou NFE.DistribuicaoDFe(UF, "CNPJ", "NSU")
                const match = jsonPayload.comando_full?.match(/DistribuicaoDFe(?:PorUltNSU)?\s*\(\s*(\d+)\s*,\s*["']?([\d]+)["']?\s*,\s*["']?(\d*)["']?\s*\)/i);

                // AcUFAutor DEVE ser int — a DLL usa para rotear para o webservice correto
                const ufInt = parseInt(match ? match[1].trim() : String(config.uf || '35'), 10);
                const cnpj = (match ? match[2].trim() : String(config.cnpj || '')).replace(/\D/g, '');
                const nsu = match ? match[3].trim() : '0';

                console.log(`[FiscalLib] >>> EXECUTANDO DISTRIBUICAO DFE: UF=${ufInt} (int), CNPJ=${cnpj}, NSU=${nsu} <<<`);
                console.log(`[FiscalLib] Usando função: NFE_DistribuicaoDFePorUltNSU`);

                // Verifica se a função foi carregada corretamente
                if (!libNFe.DistribuicaoDFePorUltNSU) {
                    throw new Error('[FiscalLib] CRÍTICO: NFE_DistribuicaoDFePorUltNSU não foi carregada. Verifique se a DLL é a versão correta (MT cdecl).');
                }

                // Chamada correta: UF como INT, conforme API oficial
                let ret;
                try {
                    ret = libNFe.DistribuicaoDFePorUltNSU(handle, ufInt, cnpj, nsu, bufferResposta, bufferTamanho);
                    console.log(`[FiscalLib] DLL retornou código: ${ret}`);
                } catch (err) {
                    console.error(`[FiscalLib] Erro crítico na chamada DLL: ${err.message}`);
                    throw new Error(`Falha na chamada NFE_DistribuicaoDFePorUltNSU: ${err.message}`);
                }

                // Lê o buffer de resposta
                const tamanhoReal = bufferTamanho.readInt32LE(0);
                const dllAtualizouTamanho = tamanhoReal !== TAMANHO_BUFFER && tamanhoReal > 0;
                const tamanhoLeitura = dllAtualizouTamanho ? Math.min(tamanhoReal, TAMANHO_BUFFER) : 0;
                const respostaString = tamanhoLeitura > 0
                    ? bufferResposta.toString('utf8', 0, tamanhoLeitura).replace(/\0/g, '').trim()
                    : '';

                if (respostaString) {
                    console.log(`[FiscalLib] Buffer DFe: ${tamanhoLeitura} bytes | Início: ${respostaString.substring(0, 300)}`);
                } else {
                    console.log(`[FiscalLib] Buffer DFe vazio. tamanhoReal=${tamanhoReal}`);
                }

                // UltimoRetorno sempre disponível como canal de diagnóstico
                const ultimoRetorno = lerRetornoACBr(libNFe, handle) || '';
                if (ultimoRetorno) console.log(`[FiscalLib] UltimoRetorno: ${ultimoRetorno.substring(0, 500)}`);

                const retornoFinal = respostaString || ultimoRetorno;

                if (ret !== 0) {
                    return { sucesso: false, erro: ultimoRetorno || `DLL código ${ret}`, retorno_completo: retornoFinal };
                }
                return { sucesso: true, retorno_completo: retornoFinal };
            });
        }

        case 'NFE.DistribuicaoDFePorChave': {
            // UF também deve ser INT nesta função
            return executarNaDLL(libNFe, config, async (handle) => {
                const bufferResposta = Buffer.alloc(TAMANHO_BUFFER);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(TAMANHO_BUFFER, 0);

                const match = jsonPayload.comando_full?.match(/DistribuicaoDFePorChave\s*\(\s*(\d+)\s*,\s*["']?([\d]+)["']?\s*,\s*["']?([^"']+)["']?\s*\)/);

                const ufInt = parseInt(match ? match[1].trim() : String(config.uf || '35'), 10);
                const cnpj = (match ? match[2].trim() : String(config.cnpj || '')).replace(/\D/g, '');
                const chave = match ? match[3].trim() : '';

                console.log(`[FiscalLib] Sincronizando DFe por Chave: UF=${ufInt} (int), CNPJ=${cnpj}, Chave=${chave}`);

                if (!libNFe.DistribuicaoDFePorChave) {
                    throw new Error('[FiscalLib] CRÍTICO: NFE_DistribuicaoDFePorChave não foi carregada.');
                }

                const ret = libNFe.DistribuicaoDFePorChave(handle, ufInt, cnpj, chave, bufferResposta, bufferTamanho);
                const ultimoRetorno = lerRetornoACBr(libNFe, handle) || '';
                if (ultimoRetorno) console.log(`[FiscalLib] UltimoRetorno: ${ultimoRetorno.substring(0, 500)}`);

                if (ret !== 0) throw new Error(ultimoRetorno || `DLL código ${ret}`);

                const tamanhoReal = bufferTamanho.readInt32LE(0);
                const resp = tamanhoReal > 0 && tamanhoReal !== TAMANHO_BUFFER
                    ? bufferResposta.toString('utf8', 0, tamanhoReal).replace(/\0/g, '').trim()
                    : ultimoRetorno;
                return { sucesso: true, retorno_completo: resp };
            });
        }

        case 'LISTAR_CERTIFICADOS':
            return new Promise((resolve) => {
                const pfxDir = jsonPayload.diretorio || "C:/Certificados";
                if (!fs.existsSync(pfxDir)) {
                    resolve({ sucesso: true, arquivos: [] });
                    return;
                }
                const arquivos = fs.readdirSync(pfxDir).filter(f => f.toLowerCase().endsWith('.pfx'));
                resolve({ sucesso: true, arquivos: arquivos.map(a => `${pfxDir}/${a}`) });
            });

        case 'LISTAR_CERTIFICADOS_WINDOWS':
            return new Promise((resolve) => {
                // Pega do CurrentUser e do LocalMachine
                const psCommand = `powershell -Command "$certs = @(); $certs += Get-ChildItem -Path Cert:\\CurrentUser\\My -ErrorAction SilentlyContinue; $certs += Get-ChildItem -Path Cert:\\LocalMachine\\My -ErrorAction SilentlyContinue; $certs | Select-Object Subject, SerialNumber, Thumbprint | ConvertTo-Json"`;
                exec(psCommand, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
                    if (error) {
                        resolve({ sucesso: false, erro: error.message });
                        return;
                    }
                    try {
                        const output = stdout.trim();
                        if (!output) {
                            resolve({ sucesso: true, certificados: [] });
                            return;
                        }
                        const parsed = JSON.parse(output);
                        const certs = Array.isArray(parsed) ? parsed : [parsed];
                        // Filtra apenas com Subject preenchido para evitar sujeiras
                        resolve({ sucesso: true, certificados: certs.filter(c => c.Subject) });
                    } catch (e) {
                        resolve({ sucesso: false, erro: "Falha ao parsear certificados: " + e.message });
                    }
                });
            });

        default:
            throw new Error(`Comando fiscal não reconhecido: ${comando}`);
    }
};

// Listener para receber comandos da thread principal
if (parentPort) {
    parentPort.on('message', async (message) => {
        try {
            // Executa a função local
            const result = await executarComandoFiscal(message.comando, message.payload);
            // Retorna sucesso
            parentPort.postMessage({ sucesso: true, result });
        } catch (error) {
            // Retorna erro para a thread principal (sem crashar o processo pai)
            parentPort.postMessage({ sucesso: false, error: error.message });
        }
    });
}
