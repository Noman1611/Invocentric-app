const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Safe defensive initialization of autoUpdater
let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater || updaterModule;
  if (autoUpdater) {
    autoUpdater.logger = console;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
  }
} catch (err) {
  console.warn('[AutoUpdater] electron-updater could not be loaded:', err?.message || err);
}

let mainWindow = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Ensure local app data directory exists for 100% private offline storage
const localDbDir = path.join(app.getPath('userData'), 'local_db');
if (!fs.existsSync(localDbDir)) {
  fs.mkdirSync(localDbDir, { recursive: true });
}

// Dedicated folder for daily automated backups
const backupDir = path.join(app.getPath('documents'), 'InvoCentric_Backups');
if (!fs.existsSync(backupDir)) {
  try { fs.mkdirSync(backupDir, { recursive: true }); } catch (e) {}
}

const http = require('http');

let localHttpServer = null;

function startLocalServer(distDir) {
  return new Promise((resolve) => {
    if (localHttpServer && localHttpServer.listening) {
      return resolve(localHttpServer.address().port);
    }

    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
      '.webmanifest': 'application/manifest+json'
    };

    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

      let filePath = path.join(distDir, reqPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          res.end(data);
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      localHttpServer = server;
      console.log(`[Local Server] Serving offline app on http://127.0.0.1:${port}`);
      resolve(port);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'InvoCentric — GST Billing & Accounting Software',
    icon: path.join(__dirname, '../public/favicon.ico'),
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Remove standard default menu bar for sleek modern desktop look
  mainWindow.setMenuBarVisibility(false);

  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1';
  const distDir = path.join(__dirname, '../dist');

  if (isDev && !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173').catch(async () => {
      try {
        const port = await startLocalServer(distDir);
        mainWindow.loadURL(`http://127.0.0.1:${port}/?source=app`);
      } catch (err) {
        mainWindow.loadFile(path.join(distDir, 'index.html'));
      }
    });
  } else {
    startLocalServer(distDir).then((port) => {
      mainWindow.loadURL(`http://127.0.0.1:${port}/?source=app`);
    }).catch(() => {
      mainWindow.loadFile(path.join(distDir, 'index.html'));
    });
  }

  mainWindow.webContents.on('console-message', (event) => {
    console.log('[Renderer Console]', event.message);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const pageInfo = await mainWindow.webContents.executeJavaScript('({ url: window.location.href, title: document.title, text: document.body.innerText.slice(0, 100).replace(/\\s+/g, " ") })');
        console.log('[ELECTRON VERIFIED READY]', JSON.stringify(pageInfo));
      } catch (err) {}
    }, 1500);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (localHttpServer) {
      try { localHttpServer.close(); } catch (e) {}
    }
  });
}

// IPC Handlers for Local PC Offline Storage
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-app-path', (event, name) => {
  if (name === 'userData') return app.getPath('userData');
  if (name === 'localDb') return localDbDir;
  return app.getPath('documents');
});

ipcMain.handle('save-local-file', async (event, filename, content) => {
  try {
    const safeFilename = path.basename(filename);
    const targetPath = path.join(localDbDir, safeFilename);
    fs.writeFileSync(targetPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
    return { success: true, path: targetPath };
  } catch (err) {
    console.error('Error saving local file in Electron:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-local-file', async (event, filename) => {
  try {
    const safeFilename = path.basename(filename);
    const targetPath = path.join(localDbDir, safeFilename);
    if (!fs.existsSync(targetPath)) return { success: true, data: null };
    const content = fs.readFileSync(targetPath, 'utf8');
    return { success: true, data: content };
  } catch (err) {
    console.error('Error reading local file in Electron:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('list-local-files', async () => {
  try {
    const files = fs.readdirSync(localDbDir);
    return { success: true, files };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Dedicated Daily Backup Handlers in specific folder
ipcMain.handle('save-daily-backup', async (event, filename, content) => {
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const safeFilename = path.basename(filename);
    const targetPath = path.join(backupDir, safeFilename);
    fs.writeFileSync(targetPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
    return { success: true, path: targetPath };
  } catch (err) {
    console.error('Error saving daily backup in Electron:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-backup-dir', () => backupDir);

ipcMain.handle('open-backup-dir', () => {
  try {
    if (fs.existsSync(backupDir)) {
      shell.openPath(backupDir);
      return { success: true, path: backupDir };
    }
  } catch (e) {
    console.error('Error opening backup directory:', e);
  }
  return { success: false };
});

// Hardware & Printing Handlers
ipcMain.handle('print-silent', async (event, options = {}) => {
  if (!mainWindow) return { success: false };
  return new Promise((resolve) => {
    mainWindow.webContents.print({ silent: true, printBackground: true, ...options }, (success, failureReason) => {
      resolve({ success, failureReason });
    });
  });
});

ipcMain.handle('print-to-pdf', async (event, defaultName = 'Invoice.pdf') => {
  if (!mainWindow) return { success: false };
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice PDF',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    const data = await mainWindow.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Auto-Updater handlers and events
ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater) {
    return { status: 'disabled', message: 'Auto-updater is not available' };
  }
  if (!app.isPackaged) {
    return { status: 'dev-mode', message: 'Auto-update is disabled in development mode' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: 'success', updateInfo: result?.updateInfo };
  } catch (err) {
    console.error('[AutoUpdater] Error checking for updates:', err);
    return { status: 'error', error: err?.message || err };
  }
});

ipcMain.handle('restart-and-install', () => {
  if (autoUpdater) {
    try {
      console.log('[AutoUpdater] Initiating restart and in-place install...');
      autoUpdater.quitAndInstall(false, true);
    } catch (err) {
      console.error('[AutoUpdater] Error during quitAndInstall:', err);
    }
  }
});

if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info?.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Software is up to date.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-not-available', info);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[AutoUpdater] Download: ${progressObj?.percent?.toFixed(1)}%`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded successfully:', info?.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Update error:', err?.message || err);
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged && autoUpdater) {
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdatesAndNotify().catch((err) => {
          console.error('[AutoUpdater] Initial check failed:', err?.message || err);
        });
      } catch (err) {
        console.error('[AutoUpdater] Error initiating auto update check:', err);
      }
    }, 4000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
