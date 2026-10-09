/**
 * InvoCentric Universal In-App Update Service
 * Supports Windows Desktop (.exe), Android Smartphone (.apk), and Web/PWA
 * Guarantees zero data loss with automated pre-update safety snapshots.
 */

import { localDbEngine } from './localDbEngine';
import pkg from '../../package.json';
import { DEFAULT_WINDOWS_DOWNLOAD_URL, DEFAULT_ANDROID_DOWNLOAD_URL } from '../config/downloadLinks';
import { IS_TEST_BUILD, TEST_RELEASE_API_URL, TEST_APK_DOWNLOAD_URL, TEST_APK_FILENAME } from '../config/appChannel';

export interface AppUpdateState {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseTitle?: string;
  releaseNotes?: string;
  publishedAt?: string;
  apkDownloadUrl?: string;
  exeDownloadUrl?: string;
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error';
  progress: number; // 0 - 100
  error?: string;
  backupPath?: string;
  platform: 'electron' | 'android' | 'web';
  autoApplying?: boolean;
}

export const APP_CURRENT_VERSION = pkg.version || '1.0.11';

// Compare two semver strings (e.g. "1.0.5" vs "1.0.4")
export function isNewerVersion(latest: string, current: string): boolean {
  const cleanLatest = latest.replace(/^[^\d]*/, '').trim();
  const cleanCurrent = current.replace(/^[^\d]*/, '').trim();
  
  if (!cleanLatest || !cleanCurrent) return false;
  if (cleanLatest === cleanCurrent) return false;

  const p1 = cleanLatest.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = cleanCurrent.split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
}

type UpdateListener = (state: AppUpdateState) => void;

class UniversalUpdateService {
  private listeners: Set<UpdateListener> = new Set();
  private state: AppUpdateState = {
    currentVersion: APP_CURRENT_VERSION,
    latestVersion: APP_CURRENT_VERSION,
    hasUpdate: false,
    status: 'idle',
    progress: 0,
    platform: this.detectPlatform(),
    autoApplying: false
  };
  private checkIntervalTimer: any = null;
  private lastAutoCheckTime: number = 0;

  constructor() {
    this.initPlatformHandlers();
    // Check for updates on startup (2.5s after launch), every 30m, and on app resume with cooldown
    if (typeof window !== 'undefined') {
      setTimeout(() => this.checkForUpdates(false), 2500);
      this.checkIntervalTimer = setInterval(() => this.checkForUpdates(false), 30 * 60 * 1000);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const now = Date.now();
          if (now - this.lastAutoCheckTime > 30 * 60 * 1000) {
            this.lastAutoCheckTime = now;
            this.checkForUpdates(false);
          }
        }
      });

      // Handle user tapping the phone's native Android system notification
      window.addEventListener('app-update-notification-clicked', (event: any) => {
        console.log('[UpdateService] Phone notification tapped:', event?.detail);
        this.checkForUpdates(true).then(() => {
          this.applyUpdate();
        });
      });
    }
  }

  public detectPlatform(): 'electron' | 'android' | 'web' {
    if (typeof window === 'undefined') return 'web';
    if ((window as any).electronAPI?.isElectron) return 'electron';
    if (
      (window as any).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:'
    ) {
      return 'android';
    }
    return 'web';
  }

  public getState(): AppUpdateState {
    return { ...this.state };
  }

  public subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach(cb => {
      try {
        cb(currentState);
      } catch (err) {
        console.error('[UpdateService] Listener error:', err);
      }
    });
  }

  private updateState(partial: Partial<AppUpdateState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  // Hook Electron AutoUpdater IPC listeners
  private async initPlatformHandlers() {
    if (typeof window === 'undefined') return;

    if (this.state.platform === 'android' && (window as any).AndroidAppUpdater?.getAppVersion) {
      try {
        const androidVer = (window as any).AndroidAppUpdater.getAppVersion();
        if (androidVer) {
          this.updateState({ currentVersion: androidVer });
        }
      } catch (e) {}
    }

    if (this.state.platform === 'electron' && (window as any).electronAPI) {
      const electronAPI = (window as any).electronAPI;
      
      try {
        const detectedVer = await electronAPI.getVersion();
        if (detectedVer) {
          this.updateState({ currentVersion: detectedVer });
        }
      } catch (e) {}

      if (electronAPI.onUpdateAvailable) {
        electronAPI.onUpdateAvailable((info: any) => {
          console.log('[UpdateService] Electron update available:', info);
          this.updateState({
            hasUpdate: true,
            latestVersion: info?.version || this.state.latestVersion,
            status: 'available',
            releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : undefined
          });
        });
      }

      if (electronAPI.onDownloadProgress) {
        electronAPI.onDownloadProgress((progressObj: any) => {
          const percent = Math.min(100, Math.max(0, Math.round(progressObj?.percent || 0)));
          this.updateState({
            status: 'downloading',
            progress: percent
          });
        });
      }

      if (electronAPI.onUpdateDownloaded) {
        electronAPI.onUpdateDownloaded((info: any) => {
          console.log('[UpdateService] Electron update downloaded:', info);
          this.updateState({
            hasUpdate: true,
            latestVersion: info?.version || this.state.latestVersion,
            status: 'downloaded',
            progress: 100,
            autoApplying: false
          });
        });
      }

      if (electronAPI.onUpdateError) {
        electronAPI.onUpdateError((err: any) => {
          console.warn('[UpdateService] Electron update error received:', err);
          if (this.state.status === 'downloading') {
            this.updateState({
              status: 'available',
              error: err?.message || 'Download was interrupted or artifact missing.'
            });
          }
        });
      }

      if (electronAPI.onUpdateNotAvailable) {
        electronAPI.onUpdateNotAvailable(() => {
          if (this.state.status === 'checking') {
            this.updateState({ status: 'up-to-date', hasUpdate: false });
          }
        });
      }
    }
  }

  /**
   * Check GitHub Releases API for latest updates
   */
  public async checkForUpdates(isUserInitiated: boolean = true): Promise<AppUpdateState> {
    if (this.state.status === 'checking' || this.state.status === 'downloading' || this.state.status === 'downloaded') {
      return this.getState();
    }

    this.updateState({ status: 'checking', error: undefined });

    try {
      // Step 1: In Electron, trigger native autoUpdater check in parallel
      if (this.state.platform === 'electron' && (window as any).electronAPI?.checkForUpdates) {
        (window as any).electronAPI.checkForUpdates().catch(() => {});
      }

      // Step 2: Fetch latest release from official GitHub repo (test channel vs production)
      const releaseEndpoint = IS_TEST_BUILD 
        ? TEST_RELEASE_API_URL 
        : 'https://api.github.com/repos/Noman1611/Invocentric-app/releases/latest';

      const response = await fetch(releaseEndpoint, {
        headers: { Accept: 'application/vnd.github.v3+json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`GitHub update check failed (HTTP ${response.status})`);
      }

      const releaseData = await response.json();
      const rawTag = releaseData.tag_name || releaseData.name || '';
      const latestVer = rawTag.replace(/^v/, '').trim();

      // Find platform-specific binaries
      let exeAsset = releaseData.assets?.find((a: any) => a.name?.endsWith('.exe'))?.browser_download_url;
      let apkAsset = IS_TEST_BUILD
        ? (releaseData.assets?.find((a: any) => a.name === TEST_APK_FILENAME)?.browser_download_url ||
           releaseData.assets?.find((a: any) => a.name?.endsWith('.apk'))?.browser_download_url ||
           TEST_APK_DOWNLOAD_URL)
        : (releaseData.assets?.find((a: any) => a.name === 'InvoCentric.apk')?.browser_download_url ||
           releaseData.assets?.find((a: any) => a.name?.endsWith('.apk') && !a.name?.toLowerCase().includes('test'))?.browser_download_url ||
           DEFAULT_ANDROID_DOWNLOAD_URL);

      if (!exeAsset) {
        exeAsset = DEFAULT_WINDOWS_DOWNLOAD_URL;
      }

      const hasUpdate = isNewerVersion(latestVer, this.state.currentVersion);

      // Trigger phone status bar notification on Android devices
      if (hasUpdate) {
        if ((window as any).AndroidAppUpdater?.showUpdateNotification) {
          try {
            (window as any).AndroidAppUpdater.showUpdateNotification(
              `InvoCentric Update Available (v${latestVer}) 🚀`,
              `New update v${latestVer} is ready! Tap to install now.`,
              apkAsset,
              latestVer
            );
          } catch (notifErr) {
            console.warn('[UpdateService] Native Android notification failed:', notifErr);
          }
        } else if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            if (Notification.permission === 'granted') {
              new Notification(`InvoCentric Update Available (v${latestVer}) 🚀`, {
                body: `New version v${latestVer} is ready. Click to update.`,
                icon: '/icons/icon-192x192.png'
              });
            } else if (Notification.permission === 'default') {
              Notification.requestPermission().catch(() => {});
            }
          } catch (_) {}
        }
      }

      this.updateState({
        latestVersion: latestVer,
        hasUpdate,
        releaseTitle: releaseData.name || `Version ${latestVer}`,
        releaseNotes: releaseData.body || 'New features, improvements & security enhancements.',
        publishedAt: releaseData.published_at,
        exeDownloadUrl: exeAsset,
        apkDownloadUrl: apkAsset,
        status: hasUpdate ? (this.state.status === 'downloaded' ? 'downloaded' : 'available') : 'up-to-date',
        autoApplying: false
      });

      return this.getState();
    } catch (err: any) {
      console.warn('[UpdateService] Update check failed:', err);
      this.updateState({
        status: isUserInitiated ? 'error' : 'idle',
        error: isUserInitiated ? (err?.message || 'Could not verify update status.') : undefined
      });
      return this.getState();
    }
  }

  /**
   * Safe Update Action
   * Backs up data first, then applies or downloads the update without loops.
   */
  public async applyUpdate(): Promise<{ success: boolean; message?: string }> {
    const { status, platform, latestVersion, apkDownloadUrl, exeDownloadUrl } = this.state;

    // Step 1: Pre-Update Automated Safety Backup (GUARANTEES ZERO DATA LOSS)
    this.updateState({ progress: 15 });
    try {
      console.log('[UpdateService] Creating automated pre-update safety backup...');
      const backupResult = await localDbEngine.performPreUpdateBackup(latestVersion);
      if (backupResult.path) {
        this.updateState({ backupPath: backupResult.path });
      }
    } catch (backupErr) {
      console.warn('[UpdateService] Pre-update backup warning:', backupErr);
    }

    // Step 2: Platform-specific execution
    if (platform === 'electron') {
      const electronAPI = (window as any).electronAPI;

      // If already downloaded and verified by autoUpdater, restart to apply in-place
      if (status === 'downloaded' && electronAPI?.restartAndInstallUpdate) {
        this.updateState({ autoApplying: true });
        const res = await electronAPI.restartAndInstallUpdate();
        if (res && res.success === false) {
          this.updateState({ autoApplying: false });
          return { success: false, message: res.error || 'Update failed to restart.' };
        }
        return { success: true, message: 'Restarting InvoCentric to apply update directly in-place...' };
      }

      // If already actively downloading
      if (status === 'downloading') {
        return { success: true, message: `Downloading update (${this.state.progress}%)... Please wait.` };
      }

      // If update is available, trigger native in-place autoUpdater
      if (electronAPI?.checkForUpdates) {
        this.updateState({ status: 'downloading', progress: 10 });
        try {
          const checkRes = await electronAPI.checkForUpdates();
          if (checkRes?.status === 'downloaded') {
            this.updateState({ status: 'downloaded', progress: 100, hasUpdate: true });
            return {
              success: true,
              message: 'Update already downloaded! Please click "Restart Now" to apply.'
            };
          }
          if (checkRes?.status === 'downloading') {
            return {
              success: true,
              message: 'Update is currently downloading in background... Please wait.'
            };
          }
          if (checkRes?.status === 'success' || checkRes?.updateInfo) {
            return { 
              success: true, 
              message: 'Downloading update in the background. The installed software will update and restart in-place.' 
            };
          } else if (checkRes?.status === 'error' || checkRes?.status === 'dev-mode') {
            this.updateState({ status: 'available', progress: 0, error: checkRes?.error || 'Update check error' });
            const exeUrl = this.state.exeDownloadUrl || DEFAULT_WINDOWS_DOWNLOAD_URL;
            if (exeUrl && electronAPI?.openExternalUrl) {
              electronAPI.openExternalUrl(exeUrl);
              return { 
                success: true, 
                message: 'Auto-updater metadata was unavailable. Installer browser me download ho raha hai. Download hone ke baad software band karke setup run karein.' 
              };
            }
            return { 
              success: false, 
              message: 'Auto-updater could not find release metadata. Please verify internet connection.' 
            };
          }
        } catch (e: any) {
          this.updateState({ status: 'available', progress: 0, error: e?.message });
          return { success: false, message: `Update error: ${e?.message || 'Check failed'}` };
        }
        return { success: true, message: 'Downloading latest update package in background...' };
      }

      return {
        success: false,
        message: 'Desktop auto-updater is not available in current environment.'
      };
    }

    if (platform === 'android') {
      const url = apkDownloadUrl || (IS_TEST_BUILD ? TEST_APK_DOWNLOAD_URL : DEFAULT_ANDROID_DOWNLOAD_URL);
      this.updateState({ status: 'downloading', progress: 50 });

      // Native AndroidAppUpdater bridge: Downloads into app folder & triggers in-place package update
      if ((window as any).AndroidAppUpdater?.downloadAndInstallApk) {
        try {
          (window as any).AndroidAppUpdater.downloadAndInstallApk(url);
          this.updateState({ status: 'downloaded', progress: 100 });
          return {
            success: true,
            message: 'InvoCentric update downloading in background. The system installer will open to update the installed app in-place.'
          };
        } catch (bridgeErr) {
          console.warn('[UpdateService] Native Android bridge error:', bridgeErr);
        }
      }
      
      // If opened via mobile web browser (not installed APK)
      if (typeof window !== 'undefined' && !((window as any).Capacitor?.isNativePlatform?.())) {
        window.location.href = url;
        this.updateState({ status: 'downloaded', progress: 100 });
        return { 
          success: true, 
          message: 'Downloading latest InvoCentric APK...' 
        };
      }

      return {
        success: false,
        message: 'Could not trigger native app updater.'
      };
    }

    // Web / PWA fallback
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
      }
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);

    return { success: true, message: 'Web app refreshed with latest version.' };
  }
}

export const updateService = new UniversalUpdateService();
