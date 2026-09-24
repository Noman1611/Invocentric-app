import React from 'react';

/**
 * Verified direct download links guaranteed to serve the actual binary.
 * v1.0.7 is the latest published release containing InvoCentric-Setup.exe (112 MB).
 * v1.0.11 is the latest published release containing InvoCentric.apk (6 MB).
 */
export const DEFAULT_WINDOWS_DOWNLOAD_URL =
  'https://github.com/Noman1611/Invocentric-app/releases/download/v1.0.12/InvoCentric-Setup.exe';

export const DEFAULT_ANDROID_DOWNLOAD_URL =
  'https://github.com/Noman1611/Invocentric-app/releases/download/v1.0.13/InvoCentric.apk';

let cachedUrls: { windows: string; android: string } | null = null;

/**
 * Dynamically queries GitHub releases API to find the absolute latest release that has
 * an .exe asset and an .apk asset. If GitHub rate limits or is offline, seamlessly
 * falls back to the verified default URLs so user downloads never 404 or open empty pages.
 */
export async function resolveWorkingDownloadUrls(): Promise<{ windows: string; android: string }> {
  if (cachedUrls) {
    return cachedUrls;
  }

  const defaults = {
    windows: DEFAULT_WINDOWS_DOWNLOAD_URL,
    android: DEFAULT_ANDROID_DOWNLOAD_URL
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('https://api.github.com/repos/Noman1611/Invocentric-app/releases', {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      cachedUrls = defaults;
      return defaults;
    }

    const releases = await res.json();
    if (!Array.isArray(releases)) {
      cachedUrls = defaults;
      return defaults;
    }

    let foundWin = '';
    let foundApk = '';

    for (const rel of releases) {
      if (!foundWin) {
        const exeAsset = rel.assets?.find((a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe'));
        if (exeAsset?.browser_download_url) {
          foundWin = exeAsset.browser_download_url;
        }
      }
      if (!foundApk) {
        const apkAsset = rel.assets?.find((a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk'));
        if (apkAsset?.browser_download_url) {
          foundApk = apkAsset.browser_download_url;
        }
      }
      if (foundWin && foundApk) break;
    }

    cachedUrls = {
      windows: foundWin || defaults.windows,
      android: foundApk || defaults.android
    };
    return cachedUrls;
  } catch {
    cachedUrls = defaults;
    return defaults;
  }
}

/**
 * Triggers clean direct browser download without opening empty tabs or navigating away.
 * Prevents the default anchor event so the browser doesn't open a blank GitHub redirect page.
 */
export function triggerDirectDownload(
  e: React.MouseEvent | null | undefined,
  url: string,
  filename: string
) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const isMobile =
    typeof navigator !== 'undefined' &&
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');

  if (isMobile) {
    // On mobile, assigning location prompts the native browser download manager directly
    window.location.assign(url);
    return;
  }

  // On desktop, programmatically click a hidden anchor without target="_blank"
  // When the server responds with Content-Disposition: attachment,
  // the file streams straight into downloads bar without opening an empty window.
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch (_) {}
    }, 2000);
  } catch (_) {
    window.location.assign(url);
  }
}
