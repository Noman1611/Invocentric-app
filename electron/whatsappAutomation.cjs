const { BrowserWindow, ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');

class WhatsAppAutomation {
  constructor() {
    this.window = null;
    this.status = 'disconnected'; // 'disconnected' | 'initializing' | 'waiting_qr' | 'connected'
    this.qrCodeData = null;
    this.sendQueue = [];
    this.isProcessingQueue = false;
    this.mainWindow = null;
  }

  init(mainWindow) {
    this.mainWindow = mainWindow;
    this.registerIpc();
  }

  registerIpc() {
    ipcMain.handle('whatsapp-get-status', () => {
      return { status: this.status, qrCode: this.qrCodeData };
    });

    ipcMain.handle('whatsapp-start-session', async () => {
      return this.startSession();
    });

    ipcMain.handle('whatsapp-disconnect', async () => {
      return this.disconnect();
    });

    ipcMain.handle('whatsapp-send-message', async (event, payload) => {
      return this.queueMessage(payload);
    });
  }

  notifyStatus(status, extra = {}) {
    this.status = status;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('whatsapp-status-changed', { status, ...extra });
    }
  }

  notifyQr(qrData) {
    this.qrCodeData = qrData;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('whatsapp-qr-code', qrData);
    }
  }

  async startSession() {
    if (this.window && !this.window.isDestroyed()) {
      return { success: true, status: this.status, qrCode: this.qrCodeData };
    }

    this.notifyStatus('initializing');

    // Create a hidden background window with persistent session partition
    this.window = new BrowserWindow({
      width: 1024,
      height: 768,
      show: false, // Runs silently in background on user's PC
      webPreferences: {
        partition: 'persist:whatsapp_local_session',
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Genuine Chrome User-Agent so WhatsApp Web accepts it flawlessly
    const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    this.window.webContents.setUserAgent(chromeUA);

    this.window.loadURL('https://web.whatsapp.com');

    // Setup QR code and login state detection
    this.setupPageMonitoring();

    return { success: true, status: 'initializing' };
  }

  setupPageMonitoring() {
    if (!this.window) return;

    const checkInterval = setInterval(async () => {
      if (!this.window || this.window.isDestroyed()) {
        clearInterval(checkInterval);
        return;
      }

      try {
        const state = await this.window.webContents.executeJavaScript(`
          (function() {
            // 1. Check if logged in: chat list or search exists
            const isChatList = Boolean(document.querySelector('#side, [data-testid="chat-list"], [aria-label="Chat list"], div[role="navigation"]'));
            if (isChatList) {
              return { type: 'connected' };
            }

            // 2. Check if QR code is visible
            const qrCanvas = document.querySelector('canvas[aria-label="Scan me!"], [data-testid="qrcode"] canvas, div[data-ref] canvas, canvas');
            if (qrCanvas) {
              try {
                return { type: 'qr', dataUrl: qrCanvas.toDataURL() };
              } catch (e) {}
            }

            return { type: 'waiting' };
          })()
        `);

        if (state && state.type === 'connected') {
          if (this.status !== 'connected') {
            this.qrCodeData = null;
            this.notifyStatus('connected');
          }
        } else if (state && state.type === 'qr' && state.dataUrl) {
          if (this.qrCodeData !== state.dataUrl) {
            this.notifyStatus('waiting_qr');
            this.notifyQr(state.dataUrl);
          }
        }
      } catch (err) {
        // Page still loading, wait for next tick
      }
    }, 1500);

    this.window.on('closed', () => {
      clearInterval(checkInterval);
      this.window = null;
      this.notifyStatus('disconnected');
    });
  }

  async queueMessage(payload) {
    if (this.status !== 'connected' || !this.window) {
      return { success: false, error: 'WhatsApp is not connected. Please scan the QR code first in Settings.' };
    }

    return new Promise((resolve) => {
      this.sendQueue.push({ payload, resolve });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.sendQueue.length === 0) return;
    this.isProcessingQueue = true;

    const item = this.sendQueue.shift();
    try {
      const result = await this.sendMessageDirect(item.payload);
      item.resolve(result);
    } catch (err) {
      item.resolve({ success: false, error: err.message });
    }

    // Natural safe human pacing (2.5 seconds gap between each message to prevent rate-limits)
    setTimeout(() => {
      this.isProcessingQueue = false;
      this.processQueue();
    }, 2500);
  }

  async sendMessageDirect({ phone, text, base64Pdf, fileName }) {
    if (!this.window || this.window.isDestroyed()) {
      return { success: false, error: 'WhatsApp background service is not running' };
    }

    // Standardize phone number: prepend 91 for Indian 10-digit numbers
    let cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const encodedText = encodeURIComponent(text || '');
    const sendUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

    await this.window.loadURL(sendUrl);

    // Wait for chat to load and click send in background
    const sendResult = await this.window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 35; // 17.5 seconds max

        const checkBtn = setInterval(async () => {
          attempts++;

          // Look for send button
          const sendBtn = document.querySelector('button span[data-icon="send"], [data-testid="send"], [data-icon="send"]')?.closest('button');
          if (sendBtn) {
            clearInterval(checkBtn);
            sendBtn.click();

            // Wait 2 seconds for message to dispatch
            setTimeout(() => {
              resolve({ success: true });
            }, 2000);
            return;
          }

          // Check if invalid phone number popup appeared
          const invalidPopup = document.querySelector('[data-testid="popup-contents"], [data-animate-modal-body="true"]');
          if (invalidPopup && invalidPopup.innerText.toLowerCase().includes('phone number shared via url is invalid')) {
            clearInterval(checkBtn);
            resolve({ success: false, error: 'Invalid customer phone number' });
            return;
          }

          if (attempts >= maxAttempts) {
            clearInterval(checkBtn);
            resolve({ success: false, error: 'Timed out waiting for WhatsApp chat to open' });
          }
        }, 500);
      });
    `);

    return sendResult;
  }

  async disconnect() {
    if (this.window && !this.window.isDestroyed()) {
      try {
        const ses = this.window.webContents.session;
        await ses.clearStorageData();
        this.window.close();
      } catch (e) {}
    }
    this.window = null;
    this.qrCodeData = null;
    this.notifyStatus('disconnected');
    return { success: true };
  }
}

module.exports = new WhatsAppAutomation();
