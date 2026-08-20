import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [closedThisSession, setClosedThisSession] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Detect iOS since it doesn't support beforeinstallprompt
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Only show on mobile
    if (!isMobile || isInstalled || closedThisSession) return;
    
    // Show banner after 3 seconds if prompt is ready or if iOS
    const timer = setTimeout(() => {
      if (deferredPrompt) {
        setShowBanner(true);
      } else if (isIOS) {
        setShowIOSPrompt(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [deferredPrompt, isIOS, isInstalled, isMobile, closedThisSession]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const closeBanner = () => {
    setShowBanner(false);
    setShowIOSPrompt(false);
    setClosedThisSession(true);
  };

  if (isInstalled || (!isMobile)) return null;

  return (
    <AnimatePresence>
      {(showBanner && deferredPrompt) && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-4 right-4 z-[9999] bg-green-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-green-500"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <Download size={22} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm tracking-tight">Install InvoCentric</p>
              <p className="text-[10px] text-green-100 uppercase tracking-widest font-black leading-none mt-1">Faster & Offline</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="bg-white text-green-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-900/10 active:scale-95 transition-all"
            >
              Install
            </button>
            <button onClick={closeBanner} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {(showIOSPrompt && isIOS) && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-4 right-4 z-[9999] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl">
              <Download size={22} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm tracking-tight">Install App</p>
              <p className="text-[10px] text-slate-500 mt-1">Tap <span className="inline-block border border-slate-700 rounded px-1.5 py-0.5 mx-0.5 text-white">Share</span> then <span className="text-white">'Add to Home Screen'</span></p>
            </div>
          </div>
          <button onClick={closeBanner} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
