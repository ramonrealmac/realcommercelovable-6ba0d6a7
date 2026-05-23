const { contextBridge, ipcRenderer } = require('electron');

// Exponha APIs seguras para o frontend aqui se necessário
contextBridge.exposeInMainWorld('electronAPI', {
  // Exemplo: sendMessage: (msg) => ipcRenderer.send('message', msg)
});
