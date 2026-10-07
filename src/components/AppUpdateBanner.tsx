import React, { useState, useEffect } from 'react';
import { updateService, AppUpdateState } from '../services/updateService';
import { motion, AnimatePresence } from 'motion/react';
import { AppUpdateButton } from './AppUpdateButton';

export { AppUpdateButton } from './AppUpdateButton';

export function AppUpdateBanner() {
  const [updateState, setUpdateState] = useState<AppUpdateState>(() => updateService.getState());
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = updateService.subscribe((state) => {
      setUpdateState(state);
    });
    return () => unsubscribe();
  }, []);

  // Web app (browser / mobile web) auto-updates via Service Worker & browser caching.
  // Never show on public web unless previewing
  const isPreview = typeof window !== 'undefined' && window.location.search.includes('preview-update');
  if (updateState.platform === 'web' && !isPreview) {
    return null;
  }

  // Only show if an actual update is available or in progress for Desktop/APK
  const shouldShow = 
    isPreview ||
    updateState.hasUpdate || 
    updateState.status === 'available' || 
    updateState.status === 'downloading' || 
    updateState.status === 'downloaded';

  if (!shouldShow || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -20, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed top-3.5 right-3.5 sm:right-6 z-[99999] print:hidden"
      >
        <AppUpdateButton 
          showDismiss={true} 
          onDismiss={() => setIsDismissed(true)} 
          forceShow={isPreview}
        />
      </motion.div>
    </AnimatePresence>
  );
}

