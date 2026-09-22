import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';
import { 
  Zap, 
  ShieldCheck, 
  HardDrive, 
  Printer, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2,
  Database
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
      icon: <HardDrive className="w-4 h-4 text-emerald-300" />,
      title: "100% Local PC Storage",
      desc: "Financial data stays safe on your computer hard drive"
    },
    {
      icon: <Database className="w-4 h-4 text-teal-300" />,
      title: "Automated Daily Backups",
      desc: "Zero data wrap or loss with timestamped folder snapshots"
    },
    {
      icon: <Zap className="w-4 h-4 text-amber-300" />,
      title: "Lightning Fast Billing",
      desc: "Create & print 2\" & 3\" thermal GST receipts in 3 seconds"
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-emerald-200" />,
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

  // Listen to keyboard shortcuts (Enter or Space or Escape to skip)
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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#07241e] text-white select-none overflow-hidden font-sans">
      {/* Dynamic Background Glowing Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#0f645d]/40 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#10b981]/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-radial from-emerald-600/10 via-teal-900/5 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Main Container Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 max-w-lg w-[92%] p-8 sm:p-10 rounded-3xl bg-[#0b332b]/85 border border-emerald-500/20 backdrop-blur-xl shadow-2xl shadow-emerald-950/60 flex flex-col items-center text-center"
      >
        {/* Animated Brand Logo with Glowing Rings */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full blur-md opacity-40 animate-ping pointer-events-none" />
          <div className="relative p-2.5 rounded-full bg-gradient-to-b from-emerald-500/20 to-teal-800/40 border border-emerald-400/40 shadow-inner">
            <Logo size={76} showBg={true} className="shadow-lg shadow-emerald-900/50" />
          </div>
        </div>

        {/* Brand Title & Tagline */}
        <div className="space-y-1.5 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-[11px] font-black uppercase tracking-wider text-emerald-300">
            <Sparkles size={13} className="text-emerald-400 animate-spin" />
            <span>Fast • Private • GST Ready</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
            Invo<span className="text-emerald-400">Centric</span>
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/70 font-medium max-w-sm mx-auto">
            India's Smart GST Billing & Inventory Software
          </p>
        </div>

        {/* Dynamic Highlight Card */}
        <div className="w-full bg-[#07251f]/80 border border-emerald-500/20 rounded-2xl p-4 mb-6 transition-all duration-300 min-h-[76px] flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            {highlights[activeHighlight].icon}
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              {highlights[activeHighlight].title}
              <CheckCircle2 size={12} className="text-emerald-400" />
            </h2>
            <p className="text-[11px] text-emerald-200/60 mt-0.5 leading-snug">
              {highlights[activeHighlight].desc}
            </p>
          </div>
        </div>

        {/* 10-Second Countdown & Progress Bar */}
        <div className="w-full space-y-2 mb-6">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300/80">
            <span>Loading billing engine...</span>
            <span className="font-mono bg-emerald-900/50 px-2 py-0.5 rounded-md border border-emerald-500/20">
              Launching in {timeLeft}s
            </span>
          </div>
          <div className="w-full h-2 bg-[#051a16] rounded-full overflow-hidden border border-emerald-500/20 p-0.5">
            <motion.div 
              className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ ease: "linear", duration: 0.5 }}
            />
          </div>
        </div>

        {/* Action Button: Skip / Quick Enter */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-emerald-500/15">
          <span className="text-[10px] text-emerald-300/50 font-medium">
            Press <kbd className="px-1.5 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/40 text-emerald-200 font-mono text-[9px]">Enter</kbd> to skip
          </span>
          <button
            onClick={onComplete}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-900/40 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Enter Now</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
