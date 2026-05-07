import { Worker } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Função principal para invocar comandos. 
 * Para comandos ACBrLib, delega para uma Worker Thread isolada,
 * prevenindo que Access Violations derrubem o processo principal.
 */
export const executarComandoFiscal = async (comando, jsonPayload) => {
    // Comandos locais que não usam a DLL (não precisam de isolamento)
    if (comando === 'LISTAR_CERTIFICADOS') {
        return new Promise((resolve) => {
            const pfxDir = jsonPayload.diretorio || "C:/Certificados";
            if (!fs.existsSync(pfxDir)) {
                resolve({ sucesso: true, arquivos: [] });
                return;
            }
            const arquivos = fs.readdirSync(pfxDir).filter(f => f.toLowerCase().endsWith('.pfx'));
            resolve({ sucesso: true, arquivos: arquivos.map(a => `${pfxDir}/${a}`) });
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

    // Para todos os outros comandos, instanciar a Worker Thread
    return new Promise((resolve, reject) => {
        console.log(`[Worker Proxy] Despachando comando ${comando} para a Worker Thread...`);
        
        const workerPath = path.resolve(__dirname, 'acbrWorkerThread.js');
        const worker = new Worker(workerPath);

        // Define um timeout para a thread caso a DLL trave indefinidamente (opcional, ex: 2 minutos)
        const timeoutId = setTimeout(() => {
            worker.terminate();
            reject(new Error("Timeout: A thread da ACBrLib travou e não respondeu após 2 minutos. Foi terminada à força."));
        }, 120000);

        worker.on('message', (message) => {
            clearTimeout(timeoutId);
            if (message.sucesso) {
                resolve(message.result);
            } else {
                reject(new Error(message.error || "Erro desconhecido na Worker Thread."));
            }
        });

        worker.on('error', (error) => {
            clearTimeout(timeoutId);
            console.error(`[Worker Proxy] 💥 CRASH CAPTURADO NA THREAD (Access Violation/etc): ${error.message}`);
            // Apenas rejeita a promise, o index.js vai marcar o evento como erro
            reject(new Error(`Falha Crítica na DLL Nativa (Worker Error): ${error.message}`));
        });

        worker.on('exit', (code) => {
            clearTimeout(timeoutId);
            if (code !== 0) {
                console.error(`[Worker Proxy] Worker thread finalizou com código anormal: ${code}`);
                reject(new Error(`Worker thread encerrou de forma anormal (código ${code})`));
            }
        });

        // Envia o payload para a thread começar o trabalho
        worker.postMessage({ comando, payload: jsonPayload });
    });
};
