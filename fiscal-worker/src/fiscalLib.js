import koffi from 'koffi';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

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

            // Funções específicas da NFe
            if (prefix === 'NFE') {
                try {
                    funcoes.DistribuicaoDFe = lib.func('int __cdecl NFE_DistribuicaoDFe(void* handle, const char* cUF, const char* cCNPJ, const char* cNSU, _Out_ char* sResposta, _Out_ int* esTamanho)');
                    funcoes.DistribuicaoDFePorChave = lib.func('int __cdecl NFE_DistribuicaoDFePorChave(void* handle, const char* cUF, const char* cCNPJ, const char* chNFe, _Out_ char* sResposta, _Out_ int* esTamanho)');
                } catch (e) {
                    console.warn("[FiscalLib] Aviso: Funções de Distribuição NFe não encontradas na DLL.");
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
 * Configura o Handle recém criado com os dados dinâmicos do Emitente
 */
const configurarHandle = (lib, handle, configPayload) => {
    // Configuração dos Schemas XSD (Obrigatório para NFe/MDFe)
    const schemasPath = path.resolve(process.cwd(), "AcbrDLL/dep/Schemas/NFe");
    lib.ConfigGravarValor(handle, "NFe", "PathSchemas", schemasPath);

    // Caminhos de Arquivos e Logs (Evita salvar em C:\Program Files\nodejs)
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
        // Usa Repositório do Windows - FORÇA TODAS AS CHAVES SSL
        lib.ConfigGravarValor(handle, "DFe", "SSLLib", "4");         // libWinCrypt
        lib.ConfigGravarValor(handle, "DFe", "SSLCryptLib", "3");   // cryWinCrypt
        lib.ConfigGravarValor(handle, "DFe", "SSLHttpLib", "2");    // httpWinHttp
        lib.ConfigGravarValor(handle, "DFe", "SSLXmlSignLib", "2"); // xsWinCrypt
        
        if (configPayload.certificadoPath) { 
            lib.ConfigGravarValor(handle, "DFe", "NumeroSerie", configPayload.certificadoPath);
            lib.ConfigGravarValor(handle, "DFe", "ArquivoPFX", "");
            lib.ConfigGravarValor(handle, "DFe", "Senha", "");
        }
    } else {
        // Usa Arquivo PFX - FORÇA TODAS AS CHAVES SSL
        lib.ConfigGravarValor(handle, "DFe", "SSLLib", "1");        // libOpenSSL
        lib.ConfigGravarValor(handle, "DFe", "SSLCryptLib", "1");   // cryOpenSSL
        lib.ConfigGravarValor(handle, "DFe", "SSLHttpLib", "3");    // httpOpenSSL
        lib.ConfigGravarValor(handle, "DFe", "SSLXmlSignLib", "4"); // xsLibXml2
        
        if (configPayload.certificadoPath) {
            lib.ConfigGravarValor(handle, "DFe", "ArquivoPFX", configPayload.certificadoPath);
            lib.ConfigGravarValor(handle, "DFe", "Senha", configPayload.certificadoSenha || "");
            lib.ConfigGravarValor(handle, "DFe", "NumeroSerie", "");
        }
    }

    if (configPayload.uf) lib.ConfigGravarValor(handle, "DFe", "UF", configPayload.uf);
    if (configPayload.ambiente) lib.ConfigGravarValor(handle, "NotaFiscal", "Ambiente", configPayload.ambiente.toString()); // 1 = Producao, 2 = Homologacao
    if (configPayload.modelo) lib.ConfigGravarValor(handle, "NotaFiscal", "Modelo", configPayload.modelo.toString()); // 55 = NFe, 65 = NFCe
    if (configPayload.cnpj) lib.ConfigGravarValor(handle, "Emitente", "CNPJ", configPayload.cnpj);
    
    // Mais configs podem ser mapeadas aqui (Webservices, Diretorios, etc)
};

/**
 * Função utilitária para chamar a DLL isolada por requisição (Multi-Thread)
 */
const executarNaDLL = async (lib, configPayload, callbackExecucao) => {
    if (!lib) throw new Error("A DLL nativa não está carregada no ambiente.");
    
    // 1. Instanciar o Handle isolado
    const handlePtr = [null]; // Koffi preencherá o array
    const arqConfig = path.resolve(process.cwd(), "ACBrNFe.ini");
    const retInit = lib.Inicializar(handlePtr, arqConfig, "");
    if (retInit !== 0) {
        let erroDetalhado = "Erro desconhecido";
        if (handlePtr[0]) {
            try { erroDetalhado = lerRetornoACBr(lib, handlePtr[0]); } catch(e) {}
        }
        throw new Error("Falha ao inicializar a ACBrLib (Handle MT). Retorno: " + retInit + " | Detalhe: " + erroDetalhado);
    }
    
    const handle = handlePtr[0];
    
    try {
        // 2. Configurar o Emitente dinamicamente
        configurarHandle(lib, handle, configPayload);
        
        // 3. Executar o fluxo da nota solicitado
        return await callbackExecucao(handle);
        
    } finally {
        // 4. Sempre finalizar e destruir o Handle na memória
        if (handle) lib.Finalizar(handle);
    }
};

/**
 * Função principal para invocar comandos na biblioteca local.
 */
export const executarComandoFiscal = async (comando, jsonPayload) => {
    const config = jsonPayload.config || {};
    const dados = jsonPayload.dados || ""; // String INI ou XML
    
    console.log(`[FiscalLib] Executando comando: ${comando}...`);
    
    switch (comando) {
        case 'EMITIR_NFE':
            config.modelo = 55;
            return executarNaDLL(libNFe, config, async (handle) => {
                libNFe.LimparLista(handle);
                
                let ret = libNFe.CarregarINI(handle, dados);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                const bufferResposta = Buffer.alloc(9999);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(9999, 0);
                
                // Enviar Lote (1)
                ret = libNFe.Enviar(handle, 1, false, true, false, bufferResposta, bufferTamanho);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                const xmlRetorno = bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0));
                return { sucesso: true, xml_retorno: xmlRetorno, retorno_completo: lerRetornoACBr(libNFe, handle) };
            });

        case 'EMITIR_NFCE':
            config.modelo = 65;
            return executarNaDLL(libNFe, config, async (handle) => {
                libNFe.LimparLista(handle);
                let ret = libNFe.CarregarINI(handle, dados);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                const bufferResposta = Buffer.alloc(9999);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(9999, 0);
                
                ret = libNFe.Enviar(handle, 1, false, true, false, bufferResposta, bufferTamanho);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                return { sucesso: true, xml_retorno: bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0)) };
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

        case 'NFE.DistribuicaoDFe':
            return executarNaDLL(libNFe, config, async (handle) => {
                const bufferResposta = Buffer.alloc(99999); 
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(99999, 0);
                
                console.log(`[FiscalLib] DEBUG - Payload:`, JSON.stringify(jsonPayload));

                // Regex para pegar os parâmetros: UF, CNPJ, NSU
                const match = jsonPayload.comando_full?.match(/DistribuicaoDFe\s*\(\s*([^,]+)\s*,\s*["']?([^"']+)["']?\s*,\s*["']?([^"']+)["']?\s*\)/i);
                
                let uf = match ? match[1].trim() : (config.uf || "35");
                let cnpj = match ? match[2].trim() : (config.cnpj || "");
                let nsu = match ? match[3].trim() : "0";

                // Limpa o CNPJ (deixa só números)
                cnpj = cnpj.replace(/\D/g, "");

                console.log(`[FiscalLib] >>> EXECUTANDO DISTRIBUICAO DFE: UF=${uf}, CNPJ=${cnpj}, NSU=${nsu} <<<`);

                let ret = libNFe.DistribuicaoDFe(handle, uf, cnpj, nsu, bufferResposta, bufferTamanho);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                return { sucesso: true, retorno_completo: bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0)) };
            });

        case 'NFE.DistribuicaoDFePorChave':
            return executarNaDLL(libNFe, config, async (handle) => {
                const bufferResposta = Buffer.alloc(99999);
                const bufferTamanho = Buffer.alloc(4);
                bufferTamanho.writeInt32LE(99999, 0);
                
                const match = jsonPayload.comando_full?.match(/DistribuicaoDFePorChave\s*\(([^,]+),\s*["']?([^"']+)["']?,\s*["']?([^"']+)["']?\)/);
                
                const uf = match ? match[1].trim() : (config.uf || "35");
                const cnpj = match ? match[2].trim() : (config.cnpj || "");
                const chave = match ? match[3].trim() : "";

                console.log(`[FiscalLib] Sincronizando DFe por Chave: UF=${uf}, CNPJ=${cnpj}, Chave=${chave}`);

                let ret = libNFe.DistribuicaoDFePorChave(handle, uf, cnpj, chave, bufferResposta, bufferTamanho);
                if (ret !== 0) throw new Error(lerRetornoACBr(libNFe, handle));
                
                return { sucesso: true, retorno_completo: bufferResposta.toString('utf8', 0, bufferTamanho.readInt32LE(0)) };
            });

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
