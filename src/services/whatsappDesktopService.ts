// Client service for Desktop WhatsApp Local Automation (Electron)

export interface WhatsAppServiceStatus {
  status: 'disconnected' | 'initializing' | 'waiting_qr' | 'connected';
  qrCode?: string | null;
}

type StatusCallback = (data: { status: WhatsAppServiceStatus['status'] }) => void;
type QrCallback = (qrDataUrl: string) => void;

class WhatsAppDesktopService {
  private statusListeners = new Set<StatusCallback>();
  private qrListeners = new Set<QrCallback>();
  private currentStatus: WhatsAppServiceStatus['status'] = 'disconnected';
  private currentQr: string | null = null;
  private initialized = false;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    if (typeof window === 'undefined') return;
    const api = (window as any).electronAPI;
    if (!api || this.initialized) return;

    this.initialized = true;

    if (api.onWhatsAppStatus) {
      api.onWhatsAppStatus((data: any) => {
        this.currentStatus = data.status;
        this.statusListeners.forEach((cb) => {
          try { cb(data); } catch (e) { console.error(e); }
        });
      });
    }

    if (api.onWhatsAppQr) {
      api.onWhatsAppQr((qr: string) => {
        this.currentQr = qr;
        this.qrListeners.forEach((cb) => {
          try { cb(qr); } catch (e) { console.error(e); }
        });
      });
    }

    // Fetch initial status
    this.getStatus();
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).electronAPI?.whatsappSendMessage);
  }

  public async getStatus(): Promise<WhatsAppServiceStatus> {
    if (!this.isSupported()) {
      return { status: 'disconnected' };
    }
    try {
      const res = await (window as any).electronAPI.whatsappGetStatus();
      if (res) {
        this.currentStatus = res.status;
        this.currentQr = res.qrCode || null;
        return res;
      }
    } catch (err) {
      console.warn('Failed to query WhatsApp automation status:', err);
    }
    return { status: this.currentStatus, qrCode: this.currentQr };
  }

  public async startSession(): Promise<{ success: boolean; status?: string }> {
    if (!this.isSupported()) return { success: false };
    return (window as any).electronAPI.whatsappStartSession();
  }

  public async disconnect(): Promise<{ success: boolean }> {
    if (!this.isSupported()) return { success: false };
    this.currentQr = null;
    this.currentStatus = 'disconnected';
    return (window as any).electronAPI.whatsappDisconnect();
  }

  public async sendMessage(payload: {
    phone: string;
    text: string;
    base64Pdf?: string;
    fileName?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Desktop automation not supported on this device' };
    }
    return (window as any).electronAPI.whatsappSendMessage(payload);
  }

  public onStatus(cb: StatusCallback) {
    this.statusListeners.add(cb);
    cb({ status: this.currentStatus });
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  public onQr(cb: QrCallback) {
    this.qrListeners.add(cb);
    if (this.currentQr) cb(this.currentQr);
    return () => {
      this.qrListeners.delete(cb);
    };
  }
}

export const whatsappDesktopService = new WhatsAppDesktopService();
