const { app, BrowserWindow } = require('electron');
const path = require('path');
const net = require('net');
const http = require('http');

// Configurações da Ponte (Integrada do provedor-bridge.cjs)
const PROVEDOR_IP = '127.0.0.1';
const PROVEDOR_PORT = 3434;
const BRIDGE_PORT = 3001;

function startBridge() {
  const server = http.createServer((req, res) => {
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
        res.end(cleaned);
      });

      client.on('error', err => {
        if (sentToBrowser) return;
        sentToBrowser = true;
        res.statusCode = 500;
        res.end('Erro no Provedor: ' + err.message);
      });

      client.on('timeout', () => {
        if (sentToBrowser) return;
        client.destroy();
      });
    });
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Porta ${BRIDGE_PORT} já está em uso. Assumindo que a ponte já está rodando.`);
    } else {
      console.error('Erro no servidor da ponte:', e);
    }
  });

  server.listen(BRIDGE_PORT, () => {
    console.log(`Ponte Integrada ativa na porta ${BRIDGE_PORT}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/icons/icon-192.png') // Fallback para ícone
  });

  // Remove o menu padrão (File, Edit, etc)
  win.setMenu(null);

  // Em desenvolvimento, carrega a URL do Vite
  // Em produção, carrega o index.html da pasta dist
  if (!app.isPackaged) {
    win.loadURL('http://localhost:8080');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  startBridge();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
