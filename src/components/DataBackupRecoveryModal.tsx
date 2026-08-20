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
  Sparkles
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
    const confirmFresh = window.confirm(
      "क्या आप वास्तव में एक नई खाली डेटाबेस शुरू करना चाहते हैं?\n(Are you sure you want to initialize a fresh empty database?)"
    );
    if (confirmFresh) {
      localStorage.setItem(`invocentric_db_initialized_${user.uid}`, 'true');
      setIsOpen(false);
      setIsForceOpen(false);
    }
  };

  if (!isOpen) return null;

  const backupMeta = autoBackup?.metadata || {};
  const backupDate = autoBackup?.timestamp 
    ? new Date(autoBackup.timestamp).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-white border-2 border-neutral-900 rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="flex items-start gap-4 p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <AlertTriangle size={26} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-amber-950 uppercase tracking-tight">
                Data Security & Recovery Required
              </h2>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-bold text-[10px] rounded-full uppercase tracking-wider">
                Action Needed
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-amber-900 leading-relaxed">
              आपकी Local Database फ़ाइल (<code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">invocentric_db.json</code>) या ब्राउज़र कैशे साफ़/डिलीट हो गई है। आगे काम करने के लिए अपनी बैकअप फ़ाइल अपलोड करें या ऑटो-बैकअप से 1-क्लिक रिस्टोर करें।
            </p>
          </div>
        </div>

        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Option 1: Automatic Backup Found Card */}
        {autoBackup && (
          <div className="bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-emerald-600 shrink-0" size={20} />
                <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wider">
                  Automatic Local Backup Mirror Found (<code className="font-mono">invocentric_backup_db</code>)
                </h3>
              </div>
              <span className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-widest">
                Ready
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white/80 border border-emerald-200 p-2.5 rounded-xl">
                <p className="text-lg font-black text-emerald-900">{backupMeta.invoice_count || autoBackup.data.invoices?.length || 0}</p>
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Invoices</p>
              </div>
              <div className="bg-white/80 border border-emerald-200 p-2.5 rounded-xl">
                <p className="text-lg font-black text-emerald-900">{backupMeta.customer_count || autoBackup.data.customers?.length || 0}</p>
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Customers</p>
              </div>
              <div className="bg-white/80 border border-emerald-200 p-2.5 rounded-xl">
                <p className="text-lg font-black text-emerald-900">{backupMeta.item_count || autoBackup.data.items?.length || 0}</p>
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Products</p>
              </div>
              <div className="bg-white/80 border border-emerald-200 p-2.5 rounded-xl">
                <p className="text-lg font-black text-emerald-900">{backupMeta.expense_count || autoBackup.data.expenses?.length || 0}</p>
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Expenses</p>
              </div>
            </div>

            {backupDate && (
              <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Last Auto-Backup Date: <strong>{backupDate}</strong></span>
              </p>
            )}

            <button
              type="button"
              disabled={isRestoring}
              onClick={handleAutoRestore}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(isRestoring && "animate-spin")} />
              {isRestoring ? "Restoring Data..." : "⚡ 1-Click Restore Everything from Auto-Backup"}
            </button>
          </div>
        )}

        {/* Option 2: Upload Backup File Zone */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <Upload size={16} className="text-neutral-700" />
              Upload Backup File (<code className="font-mono text-neutral-800">invocentric_db.json</code>)
            </h3>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">JSON File</span>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 bg-neutral-50/80 hover:bg-neutral-100/80",
              dragActive ? "border-emerald-600 bg-emerald-50/50 scale-[1.01]" : "border-neutral-300 hover:border-neutral-900"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-white border-2 border-neutral-200 flex items-center justify-center text-neutral-800 shadow-sm">
              <HardDrive size={24} />
            </div>
            <div>
              <p className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                Click or Drag & Drop Backup File Here
              </p>
              <p className="text-[11px] font-bold text-neutral-500 mt-1">
                Supports <code className="text-neutral-800 font-mono">invocentric_db.json</code> or <code className="text-neutral-800 font-mono">invocentric_backup_db.json</code>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-neutral-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          {user && (
            <button
              type="button"
              onClick={() => downloadBackupFile(user.uid)}
              className="text-xs font-black text-neutral-700 hover:text-neutral-950 flex items-center gap-1.5 uppercase tracking-wider py-2"
            >
              <Download size={14} />
              Download Current Data Snapshot
            </button>
          )}

          <button
            type="button"
            onClick={handleInitializeFresh}
            className="text-xs font-bold text-neutral-500 hover:text-red-600 transition-colors py-2 uppercase tracking-wider"
          >
            Start Fresh with Clean Database →
          </button>
        </div>
      </div>
    </div>
  );
}
