import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Logo } from './Logo';
import { 
  Zap, 
  ShieldCheck, 
  HardDrive, 
  ArrowRight, 
  CheckCircle2,
  Database,
  RefreshCw
} from 'lucide-react';

interface AppWelcomeSplashProps {
  onComplete: () => void;
  durationSeconds?: number;
}

export const AppWelcomeSplash: React.FC<AppWelcomeSplashProps> = ({ 
  onComplete,
  durationSeconds = 10 
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [activeHighlight, setActiveHighlight] = useState(0);

  const highlights = [
    {
      icon: <HardDrive className="w-4 h-4 text-emerald-600" />,
      title: "100% Local PC Storage",
      desc: "Financial data stays safe on your computer hard drive"
    },
    {
      icon: <Database className="w-4 h-4 text-teal-600" />,
      title: "Automated Daily Backups",
      desc: "Zero data loss with timestamped folder snapshots"
    },
    {
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      title: "Lightning Fast Billing",
      desc: "Create & print GST receipts in seconds"
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
      title: "Dual Mode Architecture",
      desc: "Switch between private PC drive or seamless cloud sync"
    }
  ];

  // Rotate highlights every 2.5 seconds
  useEffect(() => {
    const highlightInterval = setInterval(() => {
      setActiveHighlight(prev => (prev + 1) % highlights.length);
    }, 2500);
    return () => clearInterval(highlightInterval);
  }, [highlights.length]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  // Keyboard shortcut to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  const progressPercent = ((durationSeconds - timeLeft) / durationSeconds) * 100;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center select-none overflow-hidden font-sans"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0fdfa 100%)' }}
    >
      {/* Subtle soft light background blobs */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-100 rounded-full blur-3xl opacity-70 pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-teal-100 rounded-full blur-3xl opacity-70 pointer-events-none" />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 max-w-md w-[92%] p-8 sm:p-10 rounded-3xl flex flex-col items-center text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(16, 185, 129, 0.18)',
          boxShadow: '0 20px 60px rgba(16, 185, 129, 0.10), 0 4px 24px rgba(0,0,0,0.06)'
        }}
      >
        {/* Logo — clean, no glowing ring or ping animation */}
        <div className="mb-6">
          <div
            className="p-3 rounded-2xl inline-flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
              border: '1px solid rgba(16,185,129,0.20)'
            }}
          >
            <Logo size={72} showBg={false} className="" />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-1.5 mb-6">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-emerald-700"
            style={{ background: '#d1fae5', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <RefreshCw size={11} className="text-emerald-600" />
            <span>Fast • Private • GST Ready</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-800 mt-2">
            Invo<span className="text-emerald-600">Centric</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto">
            India's Smart GST Billing & Inventory Software
          </p>
        </div>

        {/* Rotating Highlight Card */}
        <motion.div
          key={activeHighlight}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full rounded-2xl p-4 mb-6 flex items-center gap-3 text-left min-h-[76px]"
          style={{ background: '#f0fdf4', border: '1px solid rgba(16,185,129,0.18)' }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#d1fae5', border: '1px solid rgba(16,185,129,0.22)' }}
          >
            {highlights[activeHighlight].icon}
          </div>
          <div>
            <h2 className="text-xs font-bold text-gray-700 tracking-wide flex items-center gap-1.5">
              {highlights[activeHighlight].title}
              <CheckCircle2 size={12} className="text-emerald-500" />
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
              {highlights[activeHighlight].desc}
            </p>
          </div>
        </motion.div>

        {/* Countdown & Progress Bar */}
        <div className="w-full space-y-2 mb-6">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
            <span>Loading billing engine...</span>
            <span
              className="font-mono px-2 py-0.5 rounded-md text-emerald-700"
              style={{ background: '#d1fae5' }}
            >
              Launching in {timeLeft}s
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #10b981, #14b8a6)' }}
              initial={{ width: "0%" }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ ease: "linear", duration: 0.5 }}
            />
          </div>
        </div>

        {/* Footer: Skip Button */}
        <div
          className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-3"
          style={{ borderTop: '1px solid rgba(16,185,129,0.12)' }}
        >
          <span className="text-[10px] text-gray-400 font-medium">
            Press{' '}
            <kbd
              className="px-1.5 py-0.5 rounded text-[9px] font-mono text-gray-500"
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
            >
              Enter
            </kbd>{' '}
            to skip
          </span>
          <button
            onClick={onComplete}
            className="w-full sm:w-auto px-5 py-2.5 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #059669, #0d9488)',
              boxShadow: '0 4px 14px rgba(5,150,105,0.28)'
            }}
          >
            <span>Enter Now</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

