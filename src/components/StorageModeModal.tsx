import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HardDrive, 
  Cloud, 
  FolderOpen, 
  Download, 
  Upload, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  RefreshCw, 
  Database,
  Lock,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useStorageMode } from '../contexts/StorageModeContext';

interface StorageModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorageModeModal: React.FC<StorageModeModalProps> = ({ isOpen, onClose }) => {
  const { 
    storageMode, 
    setStorageMode, 
    isLocalPc, 
    localStats, 
    triggerDailyBackup, 
    openBackupFolder,
    lastBackupDate,
    lastBackupTime,
    backupFolder,
    exportBackup,
    importBackup
  } = useStorageMode();

  const [backingUp, setBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleManualBackup = async () => {
    setBackingUp(true);
    setBackupMessage(null);
    try {
      const res = await triggerDailyBackup(true);
      if (res.success) {
        setBackupMessage(res.path ? `Backup saved to: ${res.path}` : 'Backup snapshot saved successfully!');
      } else {
        setBackupMessage('Backup failed. Please try again.');
      }
    } catch (err) {
      setBackupMessage('Error creating backup.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = await importBackup(content);
        if (ok) {
          alert('Database restored successfully from backup file!');
          onClose();
        } else {
          alert('Failed to parse or restore backup file.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl max-w-xl w-full border border-slate-200/90 shadow-2xl overflow-hidden text-slate-800"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0d5c4b] to-[#116e5a] px-6 py-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <Database size={20} className="text-emerald-300" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Storage & Backup Settings</h3>
                <p className="text-xs text-emerald-100/80 font-medium">
                  Choose where your financial database stays & configure daily backups
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Storage Mode Selector (2 Options) */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Select Your Database Storage Preference
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: 100% Local PC Storage */}
                <div
                  onClick={() => setStorageMode('local_pc')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                    isLocalPc
                      ? 'border-[#0d5c4b] bg-emerald-50/50 shadow-md shadow-emerald-900/5'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {isLocalPc && (
                    <div className="absolute top-3 right-3 text-[#0d5c4b]">
                      <CheckCircle2 size={18} className="fill-[#0d5c4b] text-white" />
                    </div>
                  )}
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0d5c4b] flex items-center justify-center mb-2.5">
                      <HardDrive size={20} />
                    </div>
                    <h4 className="text-sm font-black text-slate-900">Local PC Storage</h4>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-200/80 text-[#0d5c4b]">
                      100% Private Offline
                    </span>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      All invoices, inventory & customer data stay exclusively on your PC. No cloud data wrapping or overwrite.
                    </p>
                  </div>
                </div>

                {/* Option 2: Cloud Sync Mode */}
                <div
                  onClick={() => setStorageMode('cloud')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                    !isLocalPc
                      ? 'border-[#0d5c4b] bg-emerald-50/50 shadow-md shadow-emerald-900/5'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {!isLocalPc && (
                    <div className="absolute top-3 right-3 text-[#0d5c4b]">
                      <CheckCircle2 size={18} className="fill-[#0d5c4b] text-white" />
                    </div>
                  )}
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center mb-2.5">
                      <Cloud size={20} />
                    </div>
                    <h4 className="text-sm font-black text-slate-900">Cloud Sync Mode</h4>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-teal-200/80 text-teal-900">
                      Multi-Device Sync
                    </span>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Live sync across phone (Android APK), laptop, and web. Access your business data from anywhere.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Auto-Backup Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-emerald-700" size={18} />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Automated Daily Backup Status
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Last Auto-Backup</span>
                  <span className="font-bold text-slate-800">
                    {lastBackupDate ? `Today (${lastBackupDate})` : 'Scheduled for today'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Dedicated Backup Folder</span>
                  <span className="font-bold text-slate-800 truncate block" title={backupFolder}>
                    {backupFolder || 'Documents/InvoCentric_Backups'}
                  </span>
                </div>
              </div>

              {backupMessage && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span className="truncate">{backupMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={handleManualBackup}
                  disabled={backingUp}
                  className="px-3.5 py-2 bg-[#0d5c4b] hover:bg-[#09473a] text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw size={13} className={backingUp ? 'animate-spin' : ''} />
                  <span>{backingUp ? 'Saving Snapshot...' : 'Backup Now'}</span>
                </button>

                <button
                  onClick={openBackupFolder}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen size={13} />
                  <span>Open Backup Folder</span>
                </button>

                <button
                  onClick={exportBackup}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  title="Download full database as JSON file"
                >
                  <Download size={13} />
                  <span>Export .json</span>
                </button>

                <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
                  <Upload size={13} />
                  <span>Restore</span>
                  <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                </label>
              </div>
            </div>

            {/* Local Stats */}
            <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-3">
              <span>Local Records: {localStats.invoicesCount} Invoices • {localStats.itemsCount} Items • {localStats.customersCount} Customers</span>
              <span className="font-semibold text-emerald-800">Auto-saves on every bill</span>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200/80 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
