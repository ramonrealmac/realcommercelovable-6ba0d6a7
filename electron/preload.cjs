const { contextBridge, ipcRenderer } = require('electron');

// Exponha APIs seguras para o frontend aqui se necessário
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory')
});
