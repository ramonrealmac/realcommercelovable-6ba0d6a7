import { Worker } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let persistentWorker = null;
let currentRequest = null; // { resolve, reject, timeoutId }
let queuePromise = Promise.resolve();

const destruirWorker = () => {
    if (persistentWorker) {
        console.log("[Worker Proxy] 🔌 Encerrando Worker Thread persistente...");
        try {
            persistentWorker.terminate();
        } catch (e) {
            console.error(`[Worker Proxy] Erro ao terminar worker: ${e.message}`);
        }
        persistentWorker = null;
    }
};

const obterWorker = () => {
    if (persistentWorker) return persistentWorker;

    console.log("[Worker Proxy] 🛠️ Inicializando Worker Thread persistente...");
    const workerPath = path.resolve(__dirname, 'acbrWorkerThread.js');
    persistentWorker = new Worker(workerPath);

    persistentWorker.on('message', (message) => {
        if (!currentRequest) return;
        const { resolve, reject, timeoutId } = currentRequest;
        clearTimeout(timeoutId);
        currentRequest = null;

        if (message.sucesso) {
            resolve(message.result);
        } else {
            reject(new Error(message.error || "Erro desconhecido na Worker Thread."));
        }
    });

    persistentWorker.on('error', (error) => {
        console.error(`[Worker Proxy] 💥 CRASH CAPTURADO NA THREAD PERSISTENTE (Access Violation/etc): ${error.message}`);
        if (currentRequest) {
            const { reject, timeoutId } = currentRequest;
            clearTimeout(timeoutId);
            currentRequest = null;
            reject(new Error(`Falha Crítica na DLL Nativa (Worker Error): ${error.message}`));
        }
        destruirWorker();
    });

    persistentWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`[Worker Proxy] Worker thread persistente finalizou com código anormal: ${code}`);
            if (currentRequest) {
                const { reject, timeoutId } = currentRequest;
                clearTimeout(timeoutId);
                currentRequest = null;
                reject(new Error(`Worker thread encerrou de forma anormal (código ${code})`));
            }
        }
        destruirWorker();
    });

    return persistentWorker;
};

const dispatchToWorker = (comando, jsonPayload) => {
    return new Promise((resolve, reject) => {
        console.log(`[Worker Proxy] Despachando comando ${comando} para a Worker Thread...`);
        
        try {
            const worker = obterWorker();

            // Define um timeout de 2 minutos para a thread caso a DLL trave indefinidamente
            const timeoutId = setTimeout(() => {
                console.warn(`[Worker Proxy] ⚠️ Timeout de 2 minutos atingido para o comando ${comando}. Reiniciando worker...`);
                destruirWorker();
                reject(new Error("Timeout: A thread da ACBrLib travou e não respondeu após 2 minutos. Foi terminada à força."));
            }, 120000);

            currentRequest = { resolve, reject, timeoutId };

            // Envia o payload para a thread começar o trabalho
            worker.postMessage({ comando, payload: jsonPayload });
        } catch (err) {
            reject(new Error(`Erro ao despachar comando para o worker: ${err.message}`));
        }
    });
};

/**
 * Função principal para invocar comandos. 
 * Para comandos ACBrLib, delega para uma Worker Thread persistente de forma isolada,
 * prevenindo que Access Violations derrubem o processo principal.
 */
export const executarComandoFiscal = async (comando, jsonPayload) => {
    // Comandos locais que não usam a DLL (não precisam de isolamento)
    if (comando === 'LISTAR_CERTIFICADOS') {
        return new Promise((resolve) => {
            try {
                let pfxDir = (jsonPayload.diretorio || "C:\\Certificados").replace(/\//g, '\\');
                pfxDir = path.normalize(pfxDir).replace(/\//g, '\\');
                // Tenta criar o diretório recursivamente se ele não existir
                try {
                    if (!fs.existsSync(pfxDir)) {
                        fs.mkdirSync(pfxDir, { recursive: true });
                        console.log(`[Worker Proxy] Diretório de certificados criado/garantido: ${pfxDir}`);
                    }
                } catch (errDir) {
                    console.error(`[Worker Proxy] Erro ao criar diretório de certificados: ${errDir.message}`);
                }
                if (!fs.existsSync(pfxDir)) {
                    resolve({ sucesso: false, erro: `O diretório "${pfxDir}" não pôde ser criado ou encontrado no servidor.` });
                    return;
                }
                const arquivos = fs.readdirSync(pfxDir).filter(f => f.toLowerCase().endsWith('.pfx') || f.toLowerCase().endsWith('.p12'));
                resolve({ sucesso: true, arquivos: arquivos.map(a => path.join(pfxDir, a).replace(/\//g, '\\')) });
            } catch (e) {
                resolve({ sucesso: false, erro: "Erro ao ler certificados: " + e.message });
            }
        });
    }

    if (comando === 'LISTAR_CERTIFICADOS_WINDOWS') {
        return new Promise((resolve) => {
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
                    resolve({ sucesso: true, certificados: certs.filter(c => c.Subject) });
                } catch (e) {
                    resolve({ sucesso: false, erro: "Falha ao parsear certificados: " + e.message });
                }
            });
        });
    }

    if (comando === 'LISTAR_IMPRESSORAS') {
        return new Promise((resolve) => {
            const psCommand = `powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"`;
            exec(psCommand, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
                if (error) { resolve({ sucesso: false, erro: error.message, impressoras: [] }); return; }
                try {
                    const out = stdout.trim();
                    if (!out) { resolve({ sucesso: true, impressoras: [] }); return; }
                    const parsed = JSON.parse(out);
                    const arr = Array.isArray(parsed) ? parsed : [parsed];
                    resolve({ sucesso: true, impressoras: arr.map(p => p.Name).filter(Boolean) });
                } catch (e) {
                    resolve({ sucesso: false, erro: e.message, impressoras: [] });
                }
            });
        });
    }

    // Garante processamento estritamente sequencial na Worker Thread persistente
    const runDispatch = () => dispatchToWorker(comando, jsonPayload);

    queuePromise = queuePromise.then(runDispatch).catch((err) => {
        // Se houver falha em um comando, não impede a execução do próximo na fila
        console.error(`[Worker Proxy] Falha ao processar comando anterior na fila: ${err.message}`);
        return runDispatch();
    });

    return queuePromise;
};
