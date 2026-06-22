import * as http from "http";
import * as fs from "fs";
import * as path from "path";

// Polyfill para o localStorage no ambiente Node.js / Bun (exigido pelo cliente Supabase do frontend)
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => {
      for (const k in store) {
        delete store[k];
      }
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
}

// Carregar variáveis de ambiente manualmente do .env se não estiverem no process.env
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  } catch (err) {
    console.error("[Server] Erro ao ler arquivo .env:", err);
  }
}

loadEnv();

// Importação tardia dos serviços para garantir que os polyfills acima já estejam ativos
import { CadastroService } from "../services/api/CadastroService";
import { MovimentoService } from "../services/api/MovimentoService";

const PORT = process.env.AUTOMATION_PORT ? parseInt(process.env.AUTOMATION_PORT) : 3436;
const AGENT_SECRET = process.env.AUTOMATION_AGENT_SECRET || "fallback-secret-para-desenvolvimento";

const cadastroService = new CadastroService();
const movimentoService = new MovimentoService();

/**
 * Lê e decodifica o body JSON da requisição.
 */
function getRequestBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("Formato JSON inválido no body da requisição."));
      }
    });
    req.on("error", (err) => { reject(err); });
  });
}

/**
 * Envia uma resposta JSON padronizada.
 */
function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-agent-secret",
  });
  res.end(JSON.stringify(data));
}

// Criação do servidor HTTP
const server = http.createServer(async (req, res) => {
  // Tratar requisições CORS preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-agent-secret",
    });
    res.end();
    return;
  }

  // Apenas aceita requisições do tipo POST
  if (req.method !== "POST") {
    sendJSON(res, 405, {
      success: false,
      message: `Método ${req.method} não permitido. Utilize o método POST para esta automação.`,
    });
    return;
  }

  // Validação de segurança com o cabeçalho x-agent-secret
  const secretHeader = req.headers["x-agent-secret"];
  if (!secretHeader || secretHeader !== AGENT_SECRET) {
    sendJSON(res, 401, {
      success: false,
      message: "Acesso não autorizado. Cabeçalho 'x-agent-secret' ausente ou incorreto.",
    });
    return;
  }

  const url = req.url || "";

  try {
    if (url === "/api/tools/clientes/cadastrar") {
      const body = await getRequestBody(req) as Database["public"]["Tables"]["cadastro"]["Insert"];
      const result = await cadastroService.cadastrarCliente(body);
      sendJSON(res, result.success ? 201 : 400, result);
    } else if (url === "/api/tools/pedidos/criar") {
      const body = await getRequestBody(req) as CriarPedidoPayload;
      const result = await movimentoService.criarPedido(body);
      sendJSON(res, result.success ? 201 : 400, result);
    } else {
      sendJSON(res, 404, {
        success: false,
        message: `Endpoint '${url}' não encontrado.`,
      });
    }
  } catch (err) {
    const error = err as Error;
    sendJSON(res, 500, {
      success: false,
      message: `Erro interno ao processar requisição: ${error.message}`,
    });
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`SERVIDOR DE AUTOMAÇÃO ATIVO`);
  console.log(`Ouvindo requisições em: http://localhost:${PORT}`);
  console.log(`Endpoints disponíveis:`);
  console.log(`  - POST http://localhost:${PORT}/api/tools/clientes/cadastrar`);
  console.log(`  - POST http://localhost:${PORT}/api/tools/pedidos/criar`);
  console.log(`====================================================`);
});
