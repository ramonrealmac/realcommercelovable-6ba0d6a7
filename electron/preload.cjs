const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkEnvStatus: () => ipcRenderer.invoke('check-env-status'),
  getEnvConfig: () => ipcRenderer.invoke('get-env-config'),
  saveEnvConfig: (config) => ipcRenderer.invoke('save-env-config', config),
  loadConnections: () => ipcRenderer.invoke('load-connections'),
  saveConnections: (connections) => ipcRenderer.invoke('save-connections', connections),
  checkAdminPassword: (password) => ipcRenderer.invoke('check-admin-password', password),
  changeAdminPassword: (newPassword) => ipcRenderer.invoke('change-admin-password', newPassword),
  executeSqlQuery: (connection, query) => ipcRenderer.invoke('execute-sql-query', { connection, query }),
  restartApp: () => ipcRenderer.invoke('restart-app')
});

