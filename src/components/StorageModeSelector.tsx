import React, { useRef } from 'react';
import { useStorageMode } from '../contexts/StorageModeContext';
import { HardDrive, Cloud, ShieldCheck, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function StorageModeSelector({ className }: { className?: string }) {
  const { storageMode, setStorageMode, isLocalPc, localStats, exportBackup, importBackup } = useStorageMode();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const success = await importBackup(text);
      if (success) {
        alert('🎉 Backup restored successfully to local PC storage!');
      } else {
        alert('Failed to import backup file. Please check file format.');
      }
    } catch (err) {
      alert('Error reading backup file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn("bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Data Storage & Privacy Engine
            </h2>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
              isLocalPc ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
            )}>
              {isLocalPc ? '100% Local PC Mode' : 'Cloud Sync Mode'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Choose where your business financial records (bills, items, parties) are stored.
          </p>
        </div>

        {/* Mode Switch Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600">
            {isLocalPc ? 'Local PC Mode' : 'Cloud Sync Mode'}
          </span>
          <button
            type="button"
            onClick={() => setStorageMode(isLocalPc ? 'cloud' : 'local_pc')}
            className={cn(
              "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              isLocalPc ? "bg-[#166534]" : "bg-blue-600"
            )}
            role="switch"
            aria-checked={isLocalPc}
            title="Toggle Storage Mode"
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                isLocalPc ? "translate-x-7" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {/* Cards for Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Local PC Option */}
        <div
          onClick={() => setStorageMode('local_pc')}
          className={cn(
            "cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-4",
            isLocalPc
              ? "border-[#166534] bg-emerald-50/40 shadow-sm"
              : "border-slate-200 hover:border-slate-300 bg-white"
          )}
        >
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
            isLocalPc ? "bg-[#166534] text-white" : "bg-slate-100 text-slate-600"
          )}>
            <HardDrive size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Local PC Offline</h3>
              {isLocalPc && <CheckCircle2 size={16} className="text-emerald-600" />}
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              100% private. Invoices, stock, and customers are kept exclusively on this computer. Zero cloud sync. Works without internet.
            </p>
            {isLocalPc && (
              <div className="mt-3 text-[11px] font-mono text-emerald-800 bg-emerald-100/60 p-2 rounded-lg border border-emerald-200/50">
                💾 Invoices: {localStats.invoicesCount} | Products: {localStats.itemsCount} | Parties: {localStats.customersCount}
              </div>
            )}
          </div>
        </div>

        {/* Cloud Sync Option */}
        <div
          onClick={() => setStorageMode('cloud')}
          className={cn(
            "cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-4",
            !isLocalPc
              ? "border-blue-600 bg-blue-50/40 shadow-sm"
              : "border-slate-200 hover:border-slate-300 bg-white"
          )}
        >
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
            !isLocalPc ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
          )}>
            <Cloud size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Cloud Sync Edition</h3>
              {!isLocalPc && <CheckCircle2 size={16} className="text-blue-600" />}
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Realtime sync across phone and computer. Access your account and bills from anywhere with secure cloud backup.
            </p>
          </div>
        </div>
      </div>

      {/* Backup & Restore controls for Local PC Mode */}
      {isLocalPc && (
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Local records are securely encrypted on your hard drive.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportBackup}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>Export PC Backup (JSON)</span>
            </button>

            <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <Upload size={14} />
              <span>Import Backup</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
