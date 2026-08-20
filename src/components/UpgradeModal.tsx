import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Check, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function UpgradeModal() {
  const { activeLockedFeature, closeUpgradeModal } = useAuth();
  const navigate = useNavigate();

  if (!activeLockedFeature) return null;

  const handleUpgradeClick = () => {
    closeUpgradeModal();
    navigate('/pricing');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop overlay with blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeUpgradeModal}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative bg-white w-full max-w-md rounded-[2rem] p-8 border border-slate-100 shadow-2xl overflow-hidden z-10"
        >
          {/* Top Decorative Sparkle Background Accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#166534] via-green-500 to-[#0F3D21]" />

          {/* Close button */}
          <button
            onClick={closeUpgradeModal}
            className="absolute top-6 right-6 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-green-50 text-[#166534] flex items-center justify-center mb-4 border border-green-100/50">
              <Sparkles size={24} className="animate-pulse" />
            </div>
            
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#166534] bg-[#F0FDF4] px-3 py-1 rounded-full mb-2">
              Pro Feature
            </span>
            
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              {activeLockedFeature.name}
            </h3>
          </div>

          {/* Benefits */}
          <div className="space-y-4 mb-8 bg-slate-50/50 p-5 rounded-2xl border border-slate-100/55">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
              Unlock the following benefits:
            </p>
            {activeLockedFeature.benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#F0FDF4] flex items-center justify-center text-[#166534] shrink-0 mt-0.5">
                  <Check size={12} strokeWidth={3} />
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {benefit}
                </p>
              </div>
            ))}
          </div>

          {/* Pricing Info */}
          <div className="text-center mb-6">
            <p className="text-2xl font-black text-slate-900">
              ₹199<span className="text-xs font-bold text-slate-400">/month</span>
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              or ₹1,999/year (Save 16%)
            </p>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <button
              onClick={handleUpgradeClick}
              className="w-full bg-[#166534] hover:bg-[#0F3D21] text-white font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-all shadow-md shadow-green-700/10 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Upgrade to Pro Now</span>
              <ArrowRight size={14} />
            </button>
            
            <button
              onClick={closeUpgradeModal}
              className="w-full text-center text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest py-2 transition-colors block"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
