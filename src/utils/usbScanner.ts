// Shared client listener for the Local USB Mobile Camera Scanner Bridge

type ScanCallback = (code: string) => void;
type StatusCallback = (connected: boolean) => void;

const scanListeners = new Set<ScanCallback>();
const statusListeners = new Set<StatusCallback>();

let isConnected = false;
let eventSource: EventSource | null = null;
let reconnectTimer: any = null;

// Generate or retrieve a persistent, browser-wide unique session ID
let sessionId = localStorage.getItem('invocentric_scanner_session');
if (!sessionId) {
  sessionId = 'SESS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  localStorage.setItem('invocentric_scanner_session', sessionId);
}

export function getScannerSessionId(): string {
  return sessionId || 'default';
}

export function registerScanListener(cb: ScanCallback) {
  scanListeners.add(cb);
  return () => {
    scanListeners.delete(cb);
  };
}

export function registerStatusListener(cb: StatusCallback) {
  statusListeners.add(cb);
  cb(isConnected); // immediately trigger current state
  return () => {
    statusListeners.delete(cb);
  };
}

export function initializeUsbScanner() {
  if (eventSource) return;

  function connect() {
    if (eventSource) return;

    // Connect to Server-Sent Events endpoint with session ID
    const es = new EventSource(`/api/usb-scanner/events?sessionId=${sessionId}`);
    eventSource = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'scan' && data.code) {
          scanListeners.forEach(cb => {
            try { cb(data.code); } catch (e) { console.error(e); }
          });
        } else if (data.type === 'status') {
          isConnected = data.connected;
          statusListeners.forEach(cb => {
            try { cb(isConnected); } catch (e) { console.error(e); }
          });
        }
      } catch (err) {
        console.error('Failed to parse USB scanner SSE event:', err);
      }
    };

    es.onerror = () => {
      isConnected = false;
      statusListeners.forEach(cb => {
        try { cb(false); } catch (e) { console.error(e); }
      });
      
      try { es.close(); } catch (e) {}
      eventSource = null;

      // Auto reconnect after 3 seconds
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };
  }

  connect();
}
