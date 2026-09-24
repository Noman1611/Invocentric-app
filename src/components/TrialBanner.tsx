import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Clock, ArrowRight, CheckCircle2, Gift, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TrialBanner() {
  const { 
    isTrialActive, 
    daysLeftInTrial, 
    isTrialExpired, 
    planTier, 
    isOwner, 
    freeTrialClaimed, 
    claimFreeProTrial,
    planRenewsAt 
  } = useAuth();

  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimReceiptNo, setClaimReceiptNo] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // If user is owner, no trial banner needed
  if (isOwner) {
    return null;
  }

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await claimFreeProTrial();
      if (res.success) {
        setClaimSuccess(true);
        setClaimReceiptNo(res.receiptNumber || null);
      } else {
        setClaimError(res.message || 'Could not claim trial. Please try again.');
      }
    } catch (e: any) {
      setClaimError(e.message || 'Error claiming trial.');
    } finally {
      setClaiming(false);
    }
  };

  // State 1: Claimed just now in this session -> show celebratory confirmation
  if (claimSuccess) {
    return (
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 text-white px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-md print:hidden animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} className="text-yellow-300" />
          </div>
          <p className="text-[11px] sm:text-xs font-semibold">
            <span className="font-extrabold uppercase tracking-wide text-yellow-300">🎉 Congratulations!</span>{' '}
            Your <strong>1-Month Free Pro Plan</strong> is now active! All Pro features unlocked. Official receipt {claimReceiptNo ? `(#${claimReceiptNo})` : ''} has been sent to your email.
          </p>
        </div>
        <button
          onClick={() => setClaimSuccess(false)}
          className="text-xs px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-md font-bold text-white shrink-0 ml-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // State 2: User has NOT claimed the 1-Month Free Pro offer yet -> Show "Claim Now" button!
  if (!freeTrialClaimed && planTier !== 'pro') {
    return (
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-[#0d5c4b] text-white px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-md print:hidden">
        <div className="flex items-center gap-2 sm:gap-2.5 max-w-full overflow-hidden">
          <div className="w-6 h-6 rounded-full bg-yellow-400/20 border border-yellow-300/40 flex items-center justify-center shrink-0 animate-bounce">
            <Gift size={14} className="text-yellow-300" />
          </div>
          <div className="truncate">
            <p className="text-[11px] sm:text-xs font-semibold truncate">
              <span className="bg-yellow-400 text-slate-900 font-extrabold text-[10px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider mr-1.5 shadow-xs">
                Special Offer
              </span>
              <span className="font-extrabold">1 Month Free Pro Plan:</span>{' '}
              <span className="text-emerald-100">Claim your 30-day Pro access with AI billing, unlimited invoices & reports!</span>
            </p>
            {claimError && (
              <p className="text-[10px] text-rose-200 font-medium mt-0.5">{claimError}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-slate-950 rounded-lg text-xs font-black uppercase tracking-wider shadow-md transition-all hover:scale-105 active:scale-95 shrink-0 ml-2 disabled:opacity-60 cursor-pointer"
        >
          {claiming ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Claiming...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} className="text-slate-900" />
              <span>Claim Now</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // State 3: User claimed the trial and it is currently active -> show remaining days and View Plans button
  if (isTrialActive) {
    const formattedExpiry = planRenewsAt 
      ? new Date(planRenewsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;

    return (
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-[#0d5c4b] text-white px-3 sm:px-4 py-2 flex items-center justify-between shadow-xs print:hidden">
        <div className="flex items-center gap-2 sm:gap-2.5 max-w-full overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles size={12} className="text-yellow-300 animate-pulse" />
          </div>
          <p className="text-[11px] sm:text-xs font-semibold truncate">
            <span className="font-extrabold uppercase tracking-wide">1 Month Free Pro Active:</span>{' '}
            <span className="font-bold text-yellow-200">{daysLeftInTrial} day{daysLeftInTrial > 1 ? 's' : ''} remaining</span>
            {formattedExpiry ? ` (Valid until ${formattedExpiry})` : ''} with all Pro features unlocked.
          </p>
        </div>

        <Link
          to="/pricing"
          className="flex items-center gap-1.5 px-3 py-1 bg-white text-[#0d5c4b] hover:bg-emerald-50 rounded-lg text-[11px] font-extrabold shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0 ml-2"
        >
          <span>View Plans</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  // State 4: Trial expired
  if (isTrialExpired) {
    return (
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-rose-700 text-white px-3 sm:px-4 py-2 flex items-center justify-between shadow-xs print:hidden">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Clock size={15} className="text-yellow-300 shrink-0" />
          <p className="text-[11px] sm:text-xs font-bold">
            Your 1-month free trial has expired. Activate a Pro plan to keep all premium accounting features.
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

