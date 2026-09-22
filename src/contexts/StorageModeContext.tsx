import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { localDbEngine, LocalDbStats } from '../services/localDbEngine';

export type StorageMode = 'cloud' | 'local_pc';

interface StorageModeContextType {
  storageMode: StorageMode;
  setStorageMode: (mode: StorageMode) => void;
  isLocalPc: boolean;
  localStats: LocalDbStats;
  refreshStats: () => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: (jsonContent: string) => Promise<boolean>;
  triggerDailyBackup: (force?: boolean) => Promise<{ success: boolean; path?: string; skipped?: boolean }>;
  openBackupFolder: () => Promise<boolean>;
  lastBackupDate: string | null;
  lastBackupTime: string | null;
  backupFolder: string;
}

const StorageModeContext = createContext<StorageModeContextType | undefined>(undefined);

export function StorageModeProvider({ children }: { children: React.ReactNode }) {
  const [storageMode, setStorageModeState] = useState<StorageMode>(() => {
    const saved = localStorage.getItem('invocentric_storage_mode') as StorageMode;
    if (saved) return saved;
    // Default to 'local_pc' if running inside native Electron desktop app, otherwise 'cloud'
    return window.electronAPI?.isElectron ? 'local_pc' : 'cloud';
  });

  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => {
    return localStorage.getItem('invocentric_last_daily_backup') || null;
  });

  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('invocentric_last_daily_backup_time') || null;
  });

  const [backupFolder, setBackupFolder] = useState<string>('Documents/InvoCentric_Backups');

  const [localStats, setLocalStats] = useState<LocalDbStats>({
    invoicesCount: 0,
    itemsCount: 0,
    customersCount: 0,
    expensesCount: 0,
    purchasesCount: 0,
    lastUpdated: null
  });

  // Resolve desktop backup directory name
  useEffect(() => {
    if (window.electronAPI?.isElectron && (window.electronAPI as any)?.getBackupDir) {
      (window.electronAPI as any).getBackupDir().then((dir: string) => {
        if (dir) setBackupFolder(dir);
      }).catch(() => {});
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const stats = await localDbEngine.getStats();
      setLocalStats(stats);
    } catch (e) {
      console.warn('Failed to load local DB stats:', e);
    }
  }, []);

  const triggerDailyBackup = useCallback(async (force: boolean = false) => {
    const res = await localDbEngine.performDailyBackup(force);
    if (res.success) {
      const today = new Date().toISOString().split('T')[0];
      setLastBackupDate(today);
      setLastBackupTime(new Date().toISOString());
    }
    return res;
  }, []);

  const openBackupFolder = useCallback(async () => {
    return await localDbEngine.openBackupFolder();
  }, []);

  // Run automated daily backup on startup
  useEffect(() => {
    refreshStats();
    const handleUpdate = () => refreshStats();
    window.addEventListener('local_db_updated', handleUpdate);

    // Run automated daily backup silently
    const timer = setTimeout(() => {
      triggerDailyBackup(false).catch(err => console.warn('Daily backup auto-run error:', err));
    }, 3000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('local_db_updated', handleUpdate);
    };
  }, [refreshStats, triggerDailyBackup]);

  const setStorageMode = (mode: StorageMode) => {
    setStorageModeState(mode);
    localStorage.setItem('invocentric_storage_mode', mode);
    // Also toggle the isOfflineMode flag in localStorage so existing offline helpers align
    if (mode === 'local_pc') {
      localStorage.setItem('is_offline_mode', 'true');
      // Trigger daily backup immediately when switching to local PC mode
      triggerDailyBackup(false).catch(() => {});
    } else {
      localStorage.removeItem('is_offline_mode');
    }
    refreshStats();
  };

  const exportBackup = async () => {
    try {
      const json = await localDbEngine.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `InvoCentric_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup export error:', err);
      alert('Failed to export local backup.');
    }
  };

  const importBackup = async (jsonContent: string) => {
    const success = await localDbEngine.importAllData(jsonContent);
    if (success) {
      await refreshStats();
    }
    return success;
  };

  return (
    <StorageModeContext.Provider
      value={{
        storageMode,
        setStorageMode,
        isLocalPc: storageMode === 'local_pc',
        localStats,
        refreshStats,
        exportBackup,
        importBackup,
        triggerDailyBackup,
        openBackupFolder,
        lastBackupDate,
        lastBackupTime,
        backupFolder
      }}
    >
      {children}
    </StorageModeContext.Provider>
  );
}

export function useStorageMode() {
  const context = useContext(StorageModeContext);
  if (!context) {
    throw new Error('useStorageMode must be used within a StorageModeProvider');
  }
  return context;
}
