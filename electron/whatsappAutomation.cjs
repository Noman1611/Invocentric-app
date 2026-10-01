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

    try {
      const currentUrl = this.window.webContents.getURL() || '';
      if (currentUrl.includes('web.whatsapp.com')) {
        // Fast in-page navigation: Avoid full page reload so WhatsApp Web doesn't restart from scratch
        await this.window.webContents.executeJavaScript(`
          (function() {
            try {
              const a = document.createElement('a');
              a.href = ${JSON.stringify(sendUrl)};
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { try { a.remove(); } catch(_) {} }, 3000);
            } catch (_) {
              window.location.href = ${JSON.stringify(sendUrl)};
            }
          })()
        `).catch(() => {});
      } else {
        await this.window.loadURL(sendUrl);
      }
    } catch (navErr) {
      console.warn('[WhatsApp] In-page navigation fallback to loadURL:', navErr);
      await this.window.loadURL(sendUrl).catch(() => {});
    }

    // Wait for chat to load and click send in background (with up to 60s timeout for slower PCs)
    const sendResult = await this.window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 120; // 60 seconds max
        let attemptedEnter = false;

        function findSendButton() {
          const selectors = [
            'button span[data-icon="send"]',
            'button span[data-icon="send-light"]',
            'button span[data-icon="wds-ic-send-filled"]',
            'span[data-icon="send"]',
            'span[data-icon="send-light"]',
            'span[data-icon="wds-ic-send-filled"]',
            'button[aria-label="Send"]',
            'button[aria-label="भेजें"]',
            '[data-testid="send"]',
            '[data-testid="compose-btn-send"]',
            'footer button[data-tab="11"]'
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              return el.tagName.toLowerCase() === 'button' ? el : el.closest('button');
            }
          }
          return null;
        }

        function findComposer() {
          return document.querySelector('footer div[contenteditable="true"], div[contenteditable="true"][role="textbox"], div[contenteditable="true"][data-tab="10"]');
        }

        const checkBtn = setInterval(async () => {
          attempts++;

          // 1. Check if invalid phone number popup appeared
          const invalidPopup = document.querySelector('[data-testid="popup-contents"], [data-animate-modal-body="true"], div[role="dialog"]');
          if (invalidPopup) {
            const popupText = (invalidPopup.innerText || '').toLowerCase();
            if (
              popupText.includes('invalid') ||
              popupText.includes('phone number shared via url is invalid') ||
              popupText.includes('not on whatsapp') ||
              popupText.includes('अमान्य')
            ) {
              clearInterval(checkBtn);
              const okBtn = invalidPopup.querySelector('button');
              if (okBtn) okBtn.click();
              resolve({ success: false, error: 'Phone number is invalid or not registered on WhatsApp' });
              return;
            }
          }

          // 2. Check for "Continue to chat" or "Use WhatsApp Web" prompt if present
          const actionBtn = document.querySelector('a#action-button, [data-testid="popup-controls"] button');
          if (actionBtn && actionBtn.innerText.toLowerCase().includes('chat')) {
            actionBtn.click();
          }

          // 3. Look for send button
          const sendBtn = findSendButton();
          if (sendBtn && !sendBtn.disabled) {
            clearInterval(checkBtn);
            sendBtn.click();
            setTimeout(() => {
              resolve({ success: true });
            }, 2500);
            return;
          }

          // 4. Fallback: If composer has text loaded, dispatch Enter key
          const composer = findComposer();
          if (composer && (composer.innerText || composer.textContent || '').trim().length > 0) {
            if (!attemptedEnter || attempts % 4 === 0) {
              attemptedEnter = true;
              composer.focus();
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              composer.dispatchEvent(enterEvent);
            }
            const postBtn = findSendButton();
            if (postBtn && !postBtn.disabled) {
              clearInterval(checkBtn);
              postBtn.click();
              setTimeout(() => {
                resolve({ success: true });
              }, 2500);
              return;
            }
          }

          // 5. If 20 seconds passed and still no chat, trigger direct URL set once
          if (attempts === 40) {
            try {
              if (!window.location.href.includes(${JSON.stringify(cleanPhone)})) {
                window.location.href = ${JSON.stringify(sendUrl)};
              }
            } catch (_) {}
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
