const net = require('net');
const http = require('http');

/**
 * Ponte do Provedor (HTTP para TCP)
 * 
 * Este script permite que aplicações web (navegador) se comuniquem com o provedor
 * através de requisições HTTP, contornando a restrição de sockets TCP do browser.
 */

// Configurações do Provedor (TCP/IP)
const PROVEDOR_IP = '127.0.0.1';
const PROVEDOR_PORT = 3435;

// Servidor da Ponte (HTTP) - Porta que o sistema vai chamar
const BRIDGE_PORT = 3434;

const server = http.createServer((req, res) => {
  // Habilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    if (!body) {
      res.statusCode = 400;
      res.end('Comando vazio');
      return;
    }

    console.log('-> Comando para o Provedor:', body.trim());

    // Abre conexão TCP com o provedor
    const client = new net.Socket();
    let sentToBrowser = false;
    
    client.setTimeout(20000);

    client.connect(PROVEDOR_PORT, PROVEDOR_IP, () => {
      client.write(body + '\r\n.\r\n');
    });

    let responseData = '';
    client.on('data', data => {
      responseData += data.toString();
      
      if (responseData.includes('OK:') || responseData.includes('ERRO:')) {
        setTimeout(() => client.destroy(), 50); 
      }
    });

    client.on('close', () => {
      if (sentToBrowser) return;
      sentToBrowser = true;

      let cleaned = responseData.toString()
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '') 
        .replace(/\x03/g, '') 
        .trim();

      console.log('<- Resposta:', cleaned);
      res.end(cleaned);
    });

    client.on('error', err => {
      if (sentToBrowser) return;
      sentToBrowser = true;
      console.error('!! Erro TCP:', err.message);
      res.statusCode = 500;
      res.end('Erro no Provedor: ' + err.message);
    });

    client.on('timeout', () => {
      if (sentToBrowser) return;
      console.error('!! Timeout na conexão TCP');
      client.destroy();
    });
  });
});

server.listen(BRIDGE_PORT, () => {
  console.log('====================================================');
  console.log(`PONTE DO PROVEDOR ATIVA`);
  console.log(`Aguardando requisições em: http://localhost:${BRIDGE_PORT}`);
  console.log(`Destino TCP: ${PROVEDOR_IP}:${PROVEDOR_PORT}`);
  console.log('====================================================');
  console.log('Mantenha esta janela aberta para usar o sistema.');
});
