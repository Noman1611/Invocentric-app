import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Globe, ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react';

export default function MigrationModal() {
  const [isOldDomain, setIsOldDomain] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // Detect if we are running on any of the old Vercel or legacy domains
      const isOld = 
        hostname.includes('bill-craft') || 
        hostname.includes('bill-craft-weld') || 
        hostname === 'invocentric.vercel.app';
      
      setIsOldDomain(isOld);
    }
  }, []);

  if (!isOldDomain) return null;

  const handleMigrationAndClearCache = async () => {
    setIsMigrating(true);
    
    try {
      setStatusMessage('Clearing old session data...');
      await new Promise((r) => setTimeout(r, 600));

      // 1. Clear Local Storage
      setStatusMessage('Flushing local browser cache...');
      localStorage.clear();
      
      // 2. Clear Session Storage
      sessionStorage.clear();
      await new Promise((r) => setTimeout(r, 400));

      // 3. Delete IndexedDB Databases
      setStatusMessage('Resetting offline database tables...');
      if (window.indexedDB && window.indexedDB.databases) {
        try {
          const dbs = await window.indexedDB.databases();
          for (const db of dbs) {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (dbErr) {
          console.error('IndexedDB deletion error:', dbErr);
        }
      }
      await new Promise((r) => setTimeout(r, 400));

      // 4. Unregister Service Workers
      setStatusMessage('Unregistering legacy background services...');
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        } catch (swErr) {
          console.error('ServiceWorker unregistration error:', swErr);
        }
      }

      // 5. Clear Cache Storages
      setStatusMessage('Purging static assets...');
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
          }
        } catch (cacheErr) {
          console.error('Cache deletion error:', cacheErr);
        }
      }
      await new Promise((r) => setTimeout(r, 600));

      setStatusMessage('Redirecting to secure domain (invocentric.in)...');
      await new Promise((r) => setTimeout(r, 300));
      
    } catch (error) {
      console.error('Migration cleaning failed:', error);
    } finally {
      // Build new URL with same path and search query
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const newUrl = `https://invocentric.in${currentPath}${currentSearch}`;
      window.location.replace(newUrl);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-[9999] overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="bg-white border border-slate-100 max-w-xl w-full rounded-[32px] p-6 sm:p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full filter blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-2xl -ml-10 -mb-10 pointer-events-none" />

        <div className="flex flex-col items-center text-center">
          {/* Moving Globe & Sparkles Icon Wrapper */}
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-green-50 text-[#166534] rounded-3xl flex items-center justify-center shadow-lg shadow-green-600/5 animate-pulse">
              <Globe className="w-10 h-10" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 text-slate-900 rounded-full flex items-center justify-center shadow">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center shadow">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-green-50 border border-green-200/50 text-[#166534] text-[10px] font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
            New Domain Launch
          </div>

          {/* Titles */}
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mb-2">
            We Have Migrated to InvoCentric.in!
          </h1>
          <h2 className="text-sm sm:text-base font-extrabold text-green-700 mb-6">
            हमारी वेबसाइट अब नए डोमेन पर आ चुकी है!
          </h2>

          <div className="w-full border-t border-slate-100 my-4" />

          {/* Explanations (Hinglish & English) */}
          <div className="space-y-4 text-left max-h-[220px] overflow-y-auto pr-2 mb-8">
            <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">हिंदी / HINGLISH</p>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                प्रिय यूजर, हमारी वेबसाइट अब सुरक्षित और तेज़ गति के साथ <strong className="text-slate-900 font-bold">invocentric.in</strong> पर शिफ्ट हो गई है। पुराने डेटा या लॉगिन की किसी भी समस्या (Session Conflict) से बचने के लिए, नीचे दिए गए बटन पर क्लिक करें। यह आपके ब्राउज़र का पुराना कैश साफ़ करके आपको नए डोमेन पर ले जाएगा।
              </p>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">ENGLISH</p>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                InvoCentric has migrated to our official custom domain: <strong className="text-slate-900 font-bold">invocentric.in</strong>. To ensure a seamless migration and avoid duplicate cache issues, click below to automatically purge the old session tables, cookies, local storage, and transition instantly.
              </p>
            </div>
          </div>

          {/* Action Button & Status */}
          <div className="w-full space-y-3">
            {isMigrating ? (
              <div className="w-full bg-slate-50 border border-slate-100 py-4 px-6 rounded-2xl flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 text-[#166534] animate-spin" />
                <div className="text-center">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Syncing & Cleaning...</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">{statusMessage}</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleMigrationAndClearCache}
                className="w-full bg-[#166534] hover:bg-[#14532D] text-white py-4.5 px-6 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-green-700/10 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                Clear Cache & Switch Domain
                <span className="text-[10px] opacity-75 font-medium tracking-normal">(कैश साफ करें और वेबसाइट बदलें)</span>
              </button>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Old Vercel domains will soon stop working. Please use <strong>invocentric.in</strong>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
