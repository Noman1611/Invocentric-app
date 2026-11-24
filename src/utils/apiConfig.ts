/**
 * InvoCentric Universal API Configuration Helper
 * Ensures API requests route correctly regardless of platform:
 * - Web Browser (Production / Vercel): Relative path `/api/...` (same-origin)
 * - Android APK (Capacitor): Absolute URL `https://invocentric.in/api/...`
 * - Windows Desktop (Electron): Absolute URL `https://invocentric.in/api/...`
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // 1. Android Capacitor Native or Local WebView
    const isCapacitor = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      (window as any).Capacitor ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      // In Android Capacitor WebView, origin is https://localhost (with no port)
      (window.location.hostname === 'localhost' && !window.location.port) ||
      (/android/i.test(navigator.userAgent) && window.location.hostname === 'localhost')
    );

    // 2. Windows Electron Desktop
    const isElectron = Boolean(
      (window as any).electron ||
      (window as any).process?.versions?.electron ||
      navigator.userAgent.toLowerCase().includes('electron') ||
      window.location.protocol === 'file:' ||
      (window.location.protocol === 'http:' && window.location.hostname === '127.0.0.1' && !window.location.port)
    );

    if (isCapacitor || isElectron) {
      return 'https://invocentric.in';
    }
  }
  return '';
}

export function apiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}

apiUrl.toString = () => `${getApiBaseUrl()}/api`;
apiUrl.valueOf = () => `${getApiBaseUrl()}/api`;
