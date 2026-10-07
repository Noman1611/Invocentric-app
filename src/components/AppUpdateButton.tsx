import React, { useState, useEffect } from 'react';
import { updateService, AppUpdateState } from '../services/updateService';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Download, X } from 'lucide-react';

interface AppUpdateButtonProps {
  className?: string;
  showDismiss?: boolean;
  onDismiss?: () => void;
  // If forceShow is true, shows even in development/web preview for testing
  forceShow?: boolean;
}

/**
 * Exact Restart SVG Icon matching user's specification:
 * Green circular double-arrow with stroke #22C55E
 */
export function RestartSvgIcon({ className = '' }: { className?: string }) {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <path 
        d="M14 8A6 6 0 0 0 8 2a6.5 6.5 0 0 0-4.5 1.83L2 5.33" 
        stroke="#22C55E" 
        strokeWidth="1.6" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M2 2v3.33h3.33" 
        stroke="#22C55E" 
        strokeWidth="1.6" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M2 8a6 6 0 0 0 6 6 6.5 6.5 0 0 0 4.5-1.83L14 10.67" 
        stroke="#22C55E" 
        strokeWidth="1.6" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M10.67 10.67H14V14" 
        stroke="#22C55E" 
        strokeWidth="1.6" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Custom App Update / Restart Button
 * Styled exactly per design:
 * - Background: #0F172A
 * - Border: #1E293B (with hover emerald tint)
 * - Corner radius: 8px (rx="8")
 * - Height: 36px (h-9)
 * - Icon: #22C55E
 * - Text: #F8FAFC, 12px semibold
 * - Status Indicator: #22C55E dot with subtle live ping
 */
export function AppUpdateButton({ 
  className = '', 
  showDismiss = false,
  onDismiss,
  forceShow = false
}: AppUpdateButtonProps) {
  const [updateState, setUpdateState] = useState<AppUpdateState>(() => updateService.getState());
  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = updateService.subscribe((state) => {
      setUpdateState(state);
    });
    return () => unsubscribe();
  }, []);

  // Web app (browser) does not require manual executable restart unless forced/previewing
  if (!forceShow && updateState.platform === 'web' && !window.location.search.includes('preview-update')) {
    return null;
  }

  // Only show if there's an update available, downloading, or downloaded
  const hasPendingAction = 
    forceShow ||
    updateState.hasUpdate || 
    updateState.status === 'available' || 
    updateState.status === 'downloading' || 
    updateState.status === 'downloaded';

  if (!hasPendingAction) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;

    try {
      setIsUpdating(true);
      const res = await updateService.applyUpdate();
      if (res?.message) {
        setToastMessage(res.message);
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err: any) {
      alert(`Update action: ${err?.message || 'Update failed to initiate.'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Determine button label text based on update lifecycle state
  const getButtonText = () => {
    if (updateState.status === 'downloaded') {
      return 'Restart Now';
    }
    if (updateState.status === 'downloading') {
      return `Downloading ${Math.round(updateState.progress || 0)}%`;
    }
    if (updateState.status === 'available' || updateState.hasUpdate) {
      return 'Update Now';
    }
    return 'Update Now';
  };

  const isDownloaded = updateState.status === 'downloaded';
  const isDownloading = updateState.status === 'downloading' || isUpdating;

  return (
    <div className="relative inline-flex items-center group">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDownloading}
        title={isDownloaded ? "Restart to apply update" : "Download & install update"}
        className={`
          relative flex items-center justify-between gap-2.5
          h-[36px] min-w-[150px] max-w-[170px] px-3.5
          bg-[#0F172A] hover:bg-[#1E293B]
          border border-[#1E293B] hover:border-emerald-500/50
          rounded-[8px]
          transition-all duration-200
          shadow-md hover:shadow-emerald-950/20
          cursor-pointer select-none
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-emerald-500/40
          ${className}
        `}
      >
        {/* Left Action Icon */}
        <div className="flex items-center justify-center shrink-0">
          {isDownloading ? (
            <RefreshCw size={15} className="text-[#22C55E] animate-spin" />
          ) : isDownloaded ? (
            <RestartSvgIcon />
          ) : (
            <RestartSvgIcon />
          )}
        </div>

        {/* Center Label Text */}
        <span 
          className="text-[#F8FAFC] font-semibold text-[12px] tracking-[0.2px] truncate select-none flex-1 text-center"
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
        >
          {getButtonText()}
        </span>

        {/* Right Status Indicator Dot */}
        <div className="flex items-center justify-center shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
          </span>
        </div>
      </button>

      {/* Optional Dismiss button if in floating banner mode */}
      {showDismiss && onDismiss && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          title="Dismiss for now"
          className="ml-1.5 p-1 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
        >
          <X size={13} />
        </button>
      )}

      {/* Floating toast notification if update triggered */}
      {toastMessage && (
        <div className="absolute top-full mt-2 right-0 z-50 bg-[#0F172A] text-white border border-emerald-500/40 px-3 py-2 rounded-lg shadow-xl text-xs font-medium whitespace-nowrap flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
