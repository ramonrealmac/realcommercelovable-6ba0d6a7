const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');

// File paths
const rootDir = path.join(__dirname, '..');
const CONFIG_FILE = path.join(rootDir, 'DBConfig.ini');
const CONNECTIONS_FILE = path.join(rootDir, 'DBConnections.json');
const ENV_FILE = path.join(rootDir, '.env');

// Simple AES-256-CBC Encryption
const ENCRYPTION_KEY = crypto.scryptSync('RealcommerceSecretKeyPassphrase', 'salt', 32);
const IV_LENGTH = 16;
const DEFAULT_ADMIN_PASSWORD = 'S0ftw@y1';

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

function hideFile(filepath) {
  if (process.platform === 'win32') {
    exec(`attrib +h "${filepath}"`, (err) => {
      if (err) console.error('Erro ao ocultar arquivo:', err);
    });
  }
}

function getAdminPassword() {
  if (!fs.existsSync(CONFIG_FILE)) {
    const encrypted = encrypt(DEFAULT_ADMIN_PASSWORD);
    fs.writeFileSync(CONFIG_FILE, encrypted, 'utf8');
    hideFile(CONFIG_FILE);
    return DEFAULT_ADMIN_PASSWORD;
  }
  const content = fs.readFileSync(CONFIG_FILE, 'utf8').trim();
  const decrypted = decrypt(content);
  if (!decrypted) {
    const encrypted = encrypt(DEFAULT_ADMIN_PASSWORD);
    fs.writeFileSync(CONFIG_FILE, encrypted, 'utf8');
    hideFile(CONFIG_FILE);
    return DEFAULT_ADMIN_PASSWORD;
  }
  return decrypted;
}

function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const content = fs.readFileSync(ENV_FILE, 'utf8');
  const result = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      result[match[1]] = val;
    }
  }
  return result;
}

function writeEnvFile(config) {
  let content = '';
  for (const [key, value] of Object.entries(config)) {
    content += `${key}="${value}"\n`;
  }
  fs.writeFileSync(ENV_FILE, content, 'utf8');
  hideFile(ENV_FILE);
}

// IPC Handlers
ipcMain.handle('check-env-status', async () => {
  const env = readEnvFile();
  const configured = !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return { configured, url: env.VITE_SUPABASE_URL || '' };
});

ipcMain.handle('get-env-config', async () => {
  const env = readEnvFile();
  return {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    VITE_SUPABASE_PROJECT_ID: env.VITE_SUPABASE_PROJECT_ID || ''
  };
});

ipcMain.handle('save-env-config', async (event, config) => {
  try {
    const url = config.VITE_SUPABASE_URL.trim();
    const key = config.VITE_SUPABASE_PUBLISHABLE_KEY.trim();
    
    // Extract project ID from URL if not provided
    let projectId = config.VITE_SUPABASE_PROJECT_ID?.trim();
    if (!projectId && url) {
      const match = url.match(/https:\/\/([a-z0-9\-]+)\.supabase\.(co|in|net)/);
      if (match) projectId = match[1];
    }

    const envData = {
      SUPABASE_PUBLISHABLE_KEY: key,
      SUPABASE_URL: url,
      VITE_SUPABASE_PROJECT_ID: projectId || '',
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
      VITE_SUPABASE_URL: url
    };

    writeEnvFile(envData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-connections', async () => {
  if (!fs.existsSync(CONNECTIONS_FILE)) return [];
  try {
    const content = fs.readFileSync(CONNECTIONS_FILE, 'utf8').trim();
    const decrypted = decrypt(content);
    if (!decrypted) return [];
    return JSON.parse(decrypted);
  } catch (e) {
    return [];
  }
});

ipcMain.handle('save-connections', async (event, connections) => {
  try {
    const content = JSON.stringify(connections);
    const encrypted = encrypt(content);
    fs.writeFileSync(CONNECTIONS_FILE, encrypted, 'utf8');
    hideFile(CONNECTIONS_FILE);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-admin-password', async (event, password) => {
  const currentPassword = getAdminPassword();
  return password === currentPassword;
});

ipcMain.handle('change-admin-password', async (event, newPassword) => {
  try {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('A senha deve ter pelo menos 4 caracteres.');
    }
    const encrypted = encrypt(newPassword);
    fs.writeFileSync(CONFIG_FILE, encrypted, 'utf8');
    hideFile(CONFIG_FILE);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('execute-sql-query', async (event, { connection, query }) => {
  try {
    const cleanQuery = query.trim().toLowerCase();
    
    // Strict SELECT check (Regex word boundaries to avoid false positives in tables/columns named like 'update_logs')
    const forbiddenRegex = /\b(delete|update|drop|alter|create|insert|truncate|replace|grant|revoke)\b/i;
    if (forbiddenRegex.test(cleanQuery)) {
      throw new Error("Comando não permitido. Apenas consultas de leitura (SELECT) são autorizadas.");
    }
    
    if (!cleanQuery.startsWith('select') && !cleanQuery.startsWith('with') && !cleanQuery.startsWith('show') && !cleanQuery.startsWith('explain')) {
      throw new Error("Apenas comandos SELECT ou WITH são permitidos para execução.");
    }

    // Connect via pg client
    const { Client } = require('pg');
    
    // Parse connection details
    // If we only have Supabase URL and DB Password:
    // Supabase DB host is: db.[project-id].supabase.co
    let dbHost = connection.dbHost;
    if (!dbHost && connection.VITE_SUPABASE_URL) {
      const match = connection.VITE_SUPABASE_URL.match(/https:\/\/([a-z0-9\-]+)\.supabase\.(co|in|net)/);
      if (match) dbHost = `db.${match[1]}.supabase.co`;
    }

    if (!dbHost) {
      throw new Error("Não foi possível identificar o host do banco de dados a partir da URL do Supabase.");
    }

    if (!connection.dbPassword) {
      throw new Error("Senha do banco de dados (Postgres) não configurada para este perfil.");
    }

    const client = new Client({
      host: dbHost,
      port: parseInt(connection.dbPort) || 5432,
      database: connection.dbName || 'postgres',
      user: connection.dbUser || 'postgres',
      password: connection.dbPassword,
      ssl: { rejectUnauthorized: false }, // Required for Supabase PostgreSQL direct connections
      connectionTimeoutMillis: 10000
    });

    await client.connect();
    
    try {
      const res = await client.query(query);
      return {
        success: true,
        rows: res.rows || [],
        fields: res.fields ? res.fields.map(f => f.name) : [],
        rowCount: res.rowCount || 0
      };
    } finally {
      await client.end();
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit(0);
});


// Configurações da Ponte (Integrada do provedor-bridge.cjs)
const PROVEDOR_IP = '127.0.0.1';
const PROVEDOR_PORT = 3435;
const BRIDGE_PORT = 3434;

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
