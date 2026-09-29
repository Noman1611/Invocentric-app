// Android WebView Native Bridge for Printing, File Downloads, and Native Sharing
// Provides polyfills and automatic interception so buttons that work on web/desktop
// work seamlessly inside the Android APK.

declare global {
  interface Window {
    AndroidPrinter?: {
      print: (jobName: string) => void;
      printPdf?: (base64Pdf: string, jobName: string) => void;
    };
    AndroidFileManager?: {
      saveFile: (base64Data: string, fileName: string, mimeType: string) => void;
      shareFile: (base64Data: string, fileName: string, mimeType: string, shareText?: string) => void;
      openWhatsApp?: (phoneNumber: string, text: string) => void;
      openExternalUrl?: (url: string) => void;
    };
    AndroidAppUpdater?: {
      openExternalUrl: (url: string) => void;
      downloadAndInstallApk: (url: string) => void;
      getAppVersion: () => string;
      exitApp: () => void;
    };
    __handleAndroidDownload?: (url: string, mimeType: string) => void;
  }
}

export function isAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.AndroidPrinter || window.AndroidFileManager || window.AndroidAppUpdater);
}

// 1. Global window.print() polyfill for Android WebView
if (typeof window !== 'undefined') {
  const originalPrint = window.print;
  window.print = function () {
    if (window.AndroidPrinter && typeof window.AndroidPrinter.print === 'function') {
      try {
        const title = document.title || 'InvoCentric Document';
        window.AndroidPrinter.print(title);
        return;
      } catch (err) {
        console.error('[AndroidBridge] Print error:', err);
      }
    }
    if (originalPrint) {
      try {
        originalPrint.call(window);
      } catch (e) {
        console.warn('[AndroidBridge] Browser print error:', e);
      }
    }
  };
}

// 2. Global Universal Download Interceptor for Android WebView
// Catches all <a download> clicks (jsPDF, xlsx, statements, csv, json, backups)
if (typeof window !== 'undefined') {
  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function () {
    const hasDownloadAttr = this.hasAttribute('download') || Boolean(this.download);
    const href = this.href || '';
    const hasAndroidFileMgr = Boolean(window.AndroidFileManager && typeof window.AndroidFileManager.saveFile === 'function');

    if (hasDownloadAttr && hasAndroidFileMgr && href) {
      const fileName = this.getAttribute('download') || this.download || `download_${Date.now()}`;

      if (href.startsWith('data:')) {
        try {
          const parts = href.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
          const base64Data = parts[1];
          window.AndroidFileManager!.saveFile(base64Data, fileName, mimeType);
          return;
        } catch (e) {
          console.error('[AndroidBridge] Failed data URL save:', e);
        }
      } else if (href.startsWith('blob:')) {
        try {
          fetch(href)
            .then((res) => res.blob())
            .then((blob) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const resStr = reader.result as string;
                const base64 = resStr.includes(',') ? resStr.split(',')[1] : resStr;
                const mime = blob.type || 'application/octet-stream';
                window.AndroidFileManager!.saveFile(base64, fileName, mime);
              };
              reader.readAsDataURL(blob);
            })
            .catch((fetchErr) => {
              console.error('[AndroidBridge] Failed to read blob for Android save:', fetchErr);
            });
          return;
        } catch (e) {
          console.error('[AndroidBridge] Blob processing error:', e);
        }
      }
    }

    return originalAnchorClick.apply(this, arguments as any);
  };

  // Expose global fallback handler for WebView DownloadListener
  window.__handleAndroidDownload = function (url: string, mimeType: string) {
    if (!window.AndroidFileManager) return;
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const actualMime = mimeType || parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      window.AndroidFileManager.saveFile(parts[1], `download_${Date.now()}`, actualMime);
    } else if (url.startsWith('blob:')) {
      fetch(url)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const resStr = reader.result as string;
            const base64 = resStr.includes(',') ? resStr.split(',')[1] : resStr;
            window.AndroidFileManager!.saveFile(base64, `download_${Date.now()}`, blob.type || mimeType || 'application/octet-stream');
          };
          reader.readAsDataURL(blob);
        })
        .catch((err) => console.error('[AndroidBridge] Error in __handleAndroidDownload:', err));
    }
  };
}
