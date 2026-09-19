const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  saveLocalFile: (filename, content) => ipcRenderer.invoke('save-local-file', filename, content),
  readLocalFile: (filename) => ipcRenderer.invoke('read-local-file', filename),
  listLocalFiles: (dirName) => ipcRenderer.invoke('list-local-files', dirName),
  printToPdf: (options) => ipcRenderer.invoke('print-to-pdf', options),
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },
  restartAndInstallUpdate: () => ipcRenderer.invoke('restart-and-install')
});
