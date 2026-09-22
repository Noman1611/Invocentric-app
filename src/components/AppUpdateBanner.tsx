import React, { useState, useEffect } from 'react';
import { updateService, AppUpdateState } from '../services/updateService';
import { Sparkles, ArrowRight, ShieldCheck, Download, RefreshCw, X, CheckCircle2, HardDrive, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AppUpdateBanner() {
  const [updateState, setUpdateState] = useState<AppUpdateState>(() => updateService.getState());
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateToast, setUpdateToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = updateService.subscribe((state) => {
      setUpdateState(state);
    });
    return () => unsubscribe();
  }, []);

  // If dismissed for this session and no download is active
  if (isDismissed && updateState.status !== 'downloading' && updateState.status !== 'downloaded') {
    return null;
  }

  // Only show banner if an update is available, downloading, or ready to install
  const shouldShow = updateState.hasUpdate || updateState.status === 'downloading' || updateState.status === 'downloaded';
  if (!shouldShow) {
    return null;
  }

  const handleApplyUpdate = async () => {
    try {
      setIsUpdating(true);
      const res = await updateService.applyUpdate();
      if (res.message) {
        setUpdateToast(res.message);
        setTimeout(() => setUpdateToast(null), 6000);
      }
    } catch (err: any) {
      alert(`Update notification: ${err?.message || 'Update failed to start.'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const getPlatformLabel = () => {
    if (updateState.platform === 'electron') return 'Windows Software';
    if (updateState.platform === 'android') return 'Android Phone App';
    return 'Web App';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-[9999] bg-gradient-to-r from-emerald-900 via-[#0d5c4b] to-teal-950 text-white border-b border-emerald-500/30 shadow-lg px-3 sm:px-6 py-2 sm:py-2.5 print:hidden"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-4">
          
          {/* Left Side: Icon & Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full md:w-auto">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles size={16} className="text-emerald-300 animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                  Update Available v{updateState.latestVersion}
                </span>
                <span className="text-[11px] text-emerald-100/90 font-bold hidden sm:inline">
                  {getPlatformLabel()} (Current: v{updateState.currentVersion})
                </span>
              </div>

              {/* Data Safety Assurance Banner */}
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-emerald-100 font-medium">
                <ShieldCheck size={13} className="text-yellow-300 shrink-0" />
                <span className="truncate">
                  <span className="font-bold text-yellow-200">100% Data Surakshit:</span> Bina kisi data loss ya deletion ke pura software update ho jayega.
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Action Controls & Progress */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full md:w-auto justify-end">
            {updateState.status === 'downloading' ? (
              <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-400/30 px-3 py-1.5 rounded-xl w-full sm:w-auto justify-center">
                <RefreshCw size={14} className="text-emerald-300 animate-spin shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                    Downloading Update ({updateState.progress}%)
                  </span>
                  <div className="w-32 sm:w-40 bg-emerald-900/80 rounded-full h-1.5 mt-0.5 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${updateState.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : updateState.status === 'downloaded' ? (
              <button
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <CheckCircle2 size={15} className="text-slate-900 shrink-0" />
                <span>Restart & Apply Update</span>
              </button>
            ) : (
              <button
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 bg-white hover:bg-emerald-50 text-[#0d5c4b] rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-[#0d5c4b]" />
                    <span>Preparing...</span>
                  </>
                ) : (
                  <>
                    <Download size={13} className="text-[#0d5c4b]" />
                    <span>1-Click Update Now</span>
                    <ArrowRight size={13} className="text-[#0d5c4b]" />
                  </>
                )}
              </button>
            )}

            {/* Dismiss Button */}
            <button
              onClick={() => setIsDismissed(true)}
              title="Dismiss for this session"
              className="p-1 text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Global Toast Alert if update triggered */}
        {updateToast && (
          <div className="fixed bottom-6 right-6 z-[99999] bg-slate-950 text-white border border-emerald-500/40 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{updateToast}</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
