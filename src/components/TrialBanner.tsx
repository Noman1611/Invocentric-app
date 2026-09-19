import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TrialBanner() {
  const { isTrialActive, daysLeftInTrial, isTrialExpired, planTier, isOwner } = useAuth();

  // If user is paid Pro or owner, no trial banner needed
  if (planTier === 'pro' || isOwner) {
    return null;
  }

  if (isTrialActive) {
    return (
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-[#0d5c4b] text-white px-3 sm:px-4 py-2 flex items-center justify-between shadow-xs print:hidden">
        <div className="flex items-center gap-2 sm:gap-2.5 max-w-full overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles size={12} className="text-yellow-300 animate-pulse" />
          </div>
          <p className="text-[11px] sm:text-xs font-semibold truncate">
            <span className="font-extrabold uppercase tracking-wide">14-Day Free Trial:</span>{' '}
            <span className="font-bold text-yellow-200">{daysLeftInTrial} day{daysLeftInTrial > 1 ? 's' : ''} remaining</span> with all Pro features unlocked.
          </p>
        </div>

        <Link
          to="/pricing"
          className="flex items-center gap-1.5 px-3 py-1 bg-white text-[#0d5c4b] hover:bg-emerald-50 rounded-lg text-[11px] font-extrabold shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0 ml-2"
        >
          <span>Activate Pro</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  if (isTrialExpired) {
    return (
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-rose-700 text-white px-3 sm:px-4 py-2 flex items-center justify-between shadow-xs print:hidden">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Clock size={15} className="text-yellow-300 shrink-0" />
          <p className="text-[11px] sm:text-xs font-bold">
            Your 14-day free trial has expired. Activate a Pro plan to keep all premium accounting features.
          </p>
        </div>
        <Link
          to="/pricing"
          className="px-3.5 py-1 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm transition-all hover:scale-105 shrink-0 ml-2"
        >
          Choose Plan
        </Link>
      </div>
    );
  }

  return null;
}
