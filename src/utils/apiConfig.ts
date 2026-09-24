/**
 * InvoCentric Universal API Configuration Helper
 * Ensures API requests route correctly regardless of platform:
 * - Web Browser (Production / Vercel): Relative path `/api/...` (same-origin)
 * - Android APK (Capacitor): Absolute URL `https://invocentric.in/api/...`
 * - Windows Desktop (Electron): Absolute URL `https://invocentric.in/api/...`
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const isCapacitor = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      (/android/i.test(navigator.userAgent) && (window as any).Capacitor)
    );

    const isElectron = Boolean(
      (window as any).electron ||
      (window as any).process?.versions?.electron ||
      navigator.userAgent.toLowerCase().includes('electron') ||
      (window.location.protocol === 'http:' && window.location.hostname === '127.0.0.1')
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
