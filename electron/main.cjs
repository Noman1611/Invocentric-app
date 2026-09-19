const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// Ensure local app data directory exists for 100% private offline storage
const localDbDir = path.join(app.getPath('userData'), 'local_db');
if (!fs.existsSync(localDbDir)) {
  fs.mkdirSync(localDbDir, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'InvoCentic — GST Billing & Accounting Software',
    icon: path.join(__dirname, '../public/favicon.ico'),
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Remove standard ugly default menu bar for sleek modern desktop look
  mainWindow.setMenuBarVisibility(false);

  // In development, or if packaged dist exists
  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1';
  const distIndexPath = path.join(__dirname, '../dist/index.html');

  if (isDev && !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      if (fs.existsSync(distIndexPath)) {
        mainWindow.loadFile(distIndexPath);
      }
    });
  } else {
    mainWindow.loadFile(distIndexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
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

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
