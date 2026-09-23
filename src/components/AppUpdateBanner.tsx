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

  // Web app (browser / mobile web) auto-updates via Service Worker & browser caching.
  // User explicitly instructed: Never show update banner/button on web/smartphone web!
  if (updateState.platform === 'web') {
    return null;
  }

  // Only show if an actual update is available or in progress for Desktop/APK
  const shouldShow = updateState.hasUpdate || updateState.status === 'downloading' || updateState.status === 'downloaded';
  if (!shouldShow || isDismissed) {
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
    if (updateState.platform === 'electron') return 'Software';
    if (updateState.platform === 'android') return 'APK';
    return '';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -30, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="fixed top-3 right-3 sm:right-6 z-[99999] print:hidden"
      >
        <div className="bg-slate-950/95 text-white backdrop-blur-md border border-emerald-500/40 shadow-2xl rounded-2xl px-3 py-2 flex items-center gap-2.5 max-w-sm">
          {/* Status Icon */}
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            {updateState.status === 'downloading' ? (
              <RefreshCw size={13} className="text-emerald-300 animate-spin" />
            ) : updateState.status === 'downloaded' ? (
              <CheckCircle2 size={14} className="text-yellow-400" />
            ) : (
              <Sparkles size={13} className="text-emerald-400 animate-pulse" />
            )}
          </div>

          {/* Version badge & info */}
          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                {getPlatformLabel()} Update v{updateState.latestVersion}
              </span>
            </div>
            {updateState.status === 'downloading' ? (
              <div className="mt-1">
                <div className="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full transition-all duration-200 animate-pulse"
                    style={{ width: `${Math.max(5, updateState.progress)}%` }}
                  />
                </div>
                <span className="text-[9px] text-emerald-300 font-mono mt-0.5 block font-semibold">
                  Auto-updating {updateState.progress}%
                </span>
              </div>
            ) : updateState.status === 'downloaded' ? (
              <span className="text-[10px] text-yellow-300 font-bold block max-w-[160px]">
                {updateState.platform === 'electron' ? 'Auto-restarting in 2s...' : 'Opening installer...'}
              </span>
            ) : (
              <span className="text-[10px] text-slate-300 truncate block max-w-[140px]">
                {updateState.autoApplying ? 'Auto-updating...' : '100% Data Safe'}
              </span>
            )}
          </div>

          {/* Action Button (shown as fallback or manual force trigger) */}
          {updateState.status === 'downloaded' ? (
            <button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl text-[11px] font-black uppercase tracking-wider shadow cursor-pointer transition-transform active:scale-95"
            >
              <CheckCircle2 size={12} />
              <span>{updateState.platform === 'electron' ? 'Restart' : 'Install'}</span>
            </button>
          ) : updateState.status === 'downloading' ? (
            <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-medium px-2 py-1 bg-emerald-500/10 rounded-lg">
              <RefreshCw size={11} className="animate-spin text-emerald-400" />
              <span>Auto</span>
            </div>
          ) : (
            <button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold shadow cursor-pointer transition-transform active:scale-95"
            >
              {isUpdating ? (
                <RefreshCw size={11} className="animate-spin" />
              ) : (
                <Download size={11} />
              )}
              <span>Update</span>
            </button>
          )}

          {/* Dismiss */}
          <button
            onClick={() => setIsDismissed(true)}
            title="Dismiss"
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Floating Toast Notification */}
        {updateToast && (
          <div className="fixed bottom-6 right-6 z-[99999] bg-slate-950 text-white border border-emerald-500/40 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{updateToast}</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
