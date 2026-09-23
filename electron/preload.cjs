const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  openInChrome: (url) => ipcRenderer.invoke('open-in-chrome', url),
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  saveLocalFile: (filename, content) => ipcRenderer.invoke('save-local-file', filename, content),
  readLocalFile: (filename) => ipcRenderer.invoke('read-local-file', filename),
  listLocalFiles: (dirName) => ipcRenderer.invoke('list-local-files', dirName),
  saveDailyBackup: (filename, content) => ipcRenderer.invoke('save-daily-backup', filename, content),
  getBackupDir: () => ipcRenderer.invoke('get-backup-dir'),
  openBackupDir: () => ipcRenderer.invoke('open-backup-dir'),
  printToPdf: (options) => ipcRenderer.invoke('print-to-pdf', options),
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  onUpdateDownloaded: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  onDownloadProgress: (callback) => {
    const listener = (event, progress) => callback(progress);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
  onUpdateNotAvailable: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },
  restartAndInstallUpdate: () => ipcRenderer.invoke('restart-and-install')
});
