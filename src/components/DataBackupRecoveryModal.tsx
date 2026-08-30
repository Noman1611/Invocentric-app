import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getSecureStorage, 
  setSecureStorage 
} from '../utils/cryptoUtils';
import { 
  getAutomaticBackupSnapshot, 
  applyDataToLocalCache, 
  downloadBackupFile, 
  updateAutomaticLocalBackup,
  LocalDbBackup
} from '../utils/fileSystemDb';
import { 
  Database, 
  Upload, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ShieldCheck, 
  HardDrive, 
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function DataBackupRecoveryModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [autoBackup, setAutoBackup] = useState<{ data: LocalDbBackup; timestamp?: string; metadata?: any } | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isForceOpen, setIsForceOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isForceOpenRef = useRef<boolean>(false);

  // Check if primary local database is empty / wiped
  const checkDataIntegrity = useCallback(async () => {
    if (!user) return;
    const userId = user.uid;

    const invoices = getSecureStorage(`offline_invoices_${userId}`, []);
    const customers = getSecureStorage(`offline_customers_${userId}`, []);
    const items = getSecureStorage(`offline_items_${userId}`, []);
    const expenses = getSecureStorage(`offline_expenses_${userId}`, []);
    const totalCurrentRecords = (invoices?.length || 0) + (customers?.length || 0) + (items?.length || 0) + (expenses?.length || 0);

    // Fetch automatic backup snapshot
    const snapshot = await getAutomaticBackupSnapshot(userId);
    setAutoBackup(snapshot);

    const wasInitialized = localStorage.getItem(`invocentric_db_initialized_${userId}`) === 'true';
    const isFreshStarted = localStorage.getItem(`invocentric_fresh_started_${userId}`) === 'true';

    // If user clicked start fresh, do not force open
    if (isFreshStarted) {
      setIsOpen(false);
      setIsForceOpen(false);
      isForceOpenRef.current = false;
      return;
    }

    // If active database has 0 records BUT it was previously initialized or a backup exists
    if (totalCurrentRecords === 0 && (wasInitialized || snapshot)) {
      setIsOpen(true);
      setIsForceOpen(true);
      isForceOpenRef.current = true;
    } else {
      // Data is present or not initialized yet
      if (!isForceOpenRef.current) {
        setIsOpen(false);
      }
    }
  }, [user]);

  useEffect(() => {
    checkDataIntegrity();

    // Listen to window event for manual trigger from Settings / Header
    const handleManualOpen = () => {
      if (user) {
        getAutomaticBackupSnapshot(user.uid).then(setAutoBackup);
      }
      setIsOpen(true);
      setIsForceOpen(false);
      isForceOpenRef.current = false;
    };

    window.addEventListener('open_backup_recovery_modal', handleManualOpen);
    window.addEventListener('pc_data_synchronized', checkDataIntegrity);
    window.addEventListener('storage', checkDataIntegrity);

    return () => {
      window.removeEventListener('open_backup_recovery_modal', handleManualOpen);
      window.removeEventListener('pc_data_synchronized', checkDataIntegrity);
      window.removeEventListener('storage', checkDataIntegrity);
    };
  }, [checkDataIntegrity, user]);

  // Keep backup mirror updated whenever user makes changes
  useEffect(() => {
    if (!user) return;
    let timer: any = null;
    const handleDbChange = (e: any) => {
      const key = e?.detail?.key;
      if (key && (key.includes('backup') || key.includes('metadata'))) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        updateAutomaticLocalBackup(user.uid).catch(console.error);
      }, 500);
    };

    window.addEventListener('local_db_write', handleDbChange);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('local_db_write', handleDbChange);
    };
  }, [user]);

  // Restore from Auto-Backup mirror
  const handleAutoRestore = async () => {
    if (!user || !autoBackup?.data) return;
    setIsRestoring(true);
    setErrorMessage(null);
    try {
      applyDataToLocalCache(user.uid, autoBackup.data);
      setSuccessMessage("Automatic backup restored successfully! (डेटा सफलतापूर्वक रिस्टोर हो गया)");
      setTimeout(() => {
        setIsOpen(false);
        setIsRestoring(false);
        setSuccessMessage(null);
        window.location.reload();
      }, 1200);
    } catch (e: any) {
      setErrorMessage("Failed to restore backup: " + e.message);
      setIsRestoring(false);
    }
  };

  // Process uploaded JSON file
  const processBackupFile = (file: File) => {
    if (!user) return;
    if (!file.name.endsWith('.json')) {
      setErrorMessage("Please select a valid JSON backup file (.json)");
      return;
    }

    setIsRestoring(true);
    setErrorMessage(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as LocalDbBackup;

        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error("Invalid backup JSON format.");
        }

        const invCount = parsed.invoices?.length || 0;
        const custCount = parsed.customers?.length || 0;
        const itemCount = parsed.items?.length || 0;

        applyDataToLocalCache(user.uid, parsed);
        setSuccessMessage(`Backup file '${file.name}' restored successfully! (${invCount} Invoices, ${custCount} Customers, ${itemCount} Items)`);

        setTimeout(() => {
          setIsOpen(false);
          setIsRestoring(false);
          setSuccessMessage(null);
          window.location.reload();
        }, 1200);
      } catch (err: any) {
        setErrorMessage("Failed to read backup file. Please make sure it is a valid InvoCentric JSON file.");
        setIsRestoring(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage("Error reading file.");
      setIsRestoring(false);
    };

    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processBackupFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processBackupFile(file);
    }
  };

  const handleInitializeFresh = () => {
    if (!user) return;
    localStorage.setItem(`invocentric_db_initialized_${user.uid}`, 'true');
    localStorage.setItem(`invocentric_fresh_started_${user.uid}`, 'true');
    isForceOpenRef.current = false;
    setIsForceOpen(false);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const backupMeta = autoBackup?.metadata || {};
  const backupDate = autoBackup?.timestamp 
    ? new Date(autoBackup.timestamp).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-neutral-950/70 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white border border-neutral-200 rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 relative animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row with Close Button */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight">Database Recovery</h3>
              <p className="text-[10px] text-neutral-500 font-semibold">Local backup snapshot or fresh start</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleInitializeFresh}
            className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-neutral-700 cursor-pointer"
            title="Close / Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        {/* Informative Alert Banner */}
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
          Aapki local database cache clear ho gayi hai. Agar aapke paas backup file hai to restore karein, ya fir niche <strong>Start Fresh</strong> click karke clean shuru karein.
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Automatic Backup Mirror Option (if available and has records) */}
        {autoBackup && (backupMeta.invoices > 0 || backupMeta.customers > 0 || backupMeta.items > 0) && (
          <div className="bg-emerald-50/70 border border-emerald-300/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                <Sparkles size={14} className="text-emerald-600" />
                <span>Auto-Backup Mirror Found</span>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                Ready
              </span>
            </div>

            {/* Micro Stats Grid */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="bg-white border border-emerald-200/80 p-1.5 rounded-lg">
                <p className="text-xs font-black text-emerald-950">{backupMeta.invoices || 0}</p>
                <p className="text-[8px] font-bold text-neutral-400 uppercase">Invoices</p>
              </div>
              <div className="bg-white border border-emerald-200/80 p-1.5 rounded-lg">
                <p className="text-xs font-black text-emerald-950">{backupMeta.customers || 0}</p>
                <p className="text-[8px] font-bold text-neutral-400 uppercase">Parties</p>
              </div>
              <div className="bg-white border border-emerald-200/80 p-1.5 rounded-lg">
                <p className="text-xs font-black text-emerald-950">{backupMeta.items || 0}</p>
                <p className="text-[8px] font-bold text-neutral-400 uppercase">Items</p>
              </div>
              <div className="bg-white border border-emerald-200/80 p-1.5 rounded-lg">
                <p className="text-xs font-black text-emerald-950">{backupMeta.expenses || 0}</p>
                <p className="text-[8px] font-bold text-neutral-400 uppercase">Expenses</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAutoRestore}
              disabled={isRestoring}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isRestoring ? "animate-spin" : ""} />
              {isRestoring ? "Restoring..." : "1-Click Restore From Auto-Backup"}
            </button>
          </div>
        )}

        {/* Upload Manual File Dropzone */}
        <div className="space-y-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 bg-neutral-50 hover:bg-neutral-100",
              dragActive ? "border-emerald-600 bg-emerald-50" : "border-neutral-300"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <HardDrive size={20} className="text-neutral-600" />
            <p className="text-xs font-bold text-neutral-900">
              Upload Backup File (<code className="text-[10px] text-neutral-700">invocentric_db.json</code>)
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-neutral-100 pt-3 flex items-center justify-between gap-2">
          {user && (
            <button
              type="button"
              onClick={() => downloadBackupFile(user.uid)}
              className="text-[11px] font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 uppercase tracking-wider py-1 cursor-pointer"
            >
              <Download size={13} />
              Export Snapshot
            </button>
          )}

          <button
            type="button"
            onClick={handleInitializeFresh}
            className="text-[11px] font-black text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider cursor-pointer"
          >
            Start Fresh with Clean Database →
          </button>
        </div>
      </div>
    </div>
  );
}
