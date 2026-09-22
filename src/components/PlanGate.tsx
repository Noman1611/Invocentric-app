import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldAlert, RefreshCw, LogIn, Globe, Wifi, WifiOff } from 'lucide-react';
import { Logo } from './Logo';

export function PlanGate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isOwner, planStatus, loading, refreshUserData, logout, isOfflineMode } = useAuth();
  const location = useLocation();
  const [mustCheckOnline, setMustCheckOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  // Helper to compute Monday date key for current week (YYYY-MM-DD)
  const getMondayKey = () => {
    const d = new Date();
    const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    return monday.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (!user) return;

    // Exempt admin or owner
    if (isOwner || isAdmin || user.email?.toLowerCase() === 'nomanshaikh1999@gmail.com') {
      setMustCheckOnline(false);
      return;
    }

    const checkMondayReauth = async () => {
      const now = new Date();
      // Check if today is Monday (1)
      const isMonday = now.getDay() === 1;

      // If today is NOT Monday, do NOT block the user
      if (!isMonday) {
        setMustCheckOnline(false);
        return;
      }

      const currentMondayKey = getMondayKey();
      const lastCheckMonday = localStorage.getItem('last_plan_check_monday');

      // If already verified this Monday, do not block and do not ask again
      if (lastCheckMonday === currentMondayKey) {
        setMustCheckOnline(false);
        return;
      }

      // If user is online on Monday, attempt silent background auto-verification
      if (navigator.onLine) {
        try {
          await refreshUserData();
          localStorage.setItem('last_plan_check_monday', currentMondayKey);
          localStorage.setItem('last_plan_check_date', now.toDateString());
          setMustCheckOnline(false);
          return;
        } catch (e) {
          console.warn("Silent Monday verification notice:", e);
        }
      }

      // If offline or silent check failed on Monday, prompt verification
      setMustCheckOnline(true);
    };

    checkMondayReauth();
    // Re-check periodically (every hour) while app is open
    const interval = setInterval(checkMondayReauth, 3600000);
    return () => clearInterval(interval);
  }, [user, isOwner, isAdmin]);

  const handleVerify = async () => {
    setChecking(true);
    try {
      // Check if we can reach the internet
      if (!navigator.onLine) {
        alert("Please connect to the internet to verify your plan.");
        return;
      }
      await refreshUserData();
      const currentMondayKey = getMondayKey();
      localStorage.setItem('last_plan_check_monday', currentMondayKey);
      localStorage.setItem('last_plan_check_date', new Date().toDateString());
      setMustCheckOnline(false);
    } catch (err) {
      console.error(err);
      alert("Verification failed. Please check your internet connection.");
    } finally {
      setChecking(false);
    }
  };

  if (loading) return null;

  // Bypass PlanGate for the pricing page
  if (location.pathname === '/pricing') {
    return <>{children}</>;
  }

  if (mustCheckOnline) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-neutral-50 rounded-[2.5rem] p-10 text-center border border-neutral-100 shadow-2xl shadow-blue-900/5"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/20">
            <RefreshCw className={checking ? "animate-spin text-white" : "text-white"} size={40} />
          </div>
          <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tight mb-2">Weekly Verification</h2>
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] mb-8 leading-relaxed">
            Har Monday ko aapka plan verify karne ke liye 1 baar online aana zaroori hai.
          </p>

          <button
            onClick={handleVerify}
            disabled={checking}
            className="w-full flex items-center justify-center gap-3 bg-neutral-900 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-neutral-800 transition-all mb-4 disabled:opacity-50"
          >
            {checking ? "Checking..." : "Verify Online Now"}
            <Globe size={18} />
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 bg-white text-neutral-900 border border-neutral-200 font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-sm hover:bg-neutral-50 transition-all"
          >
            Login Again
            <LogIn size={16} />
          </button>
        </motion.div>
      </div>
    );
  }

  if (planStatus !== 'active' && planStatus !== 'trial') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-red-50 rounded-[2.5rem] p-10 text-center border border-red-100 shadow-2xl shadow-red-900/5"
        >
          <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-600/20">
            <ShieldAlert className="text-white" size={40} />
          </div>
          <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tight mb-2">Plan Expired</h2>
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] mb-8 leading-relaxed">
            Your InvoCentric plan has expired. Please renew your plan to continue using the service.
          </p>

          <div className="bg-white rounded-3xl p-6 mb-8 border border-red-100/50">
             <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Contact Admin</p>
             <p className="text-lg font-black text-neutral-900">+91 9876543210</p>
          </div>

          <button
            onClick={handleVerify}
            disabled={checking}
            className="w-full flex items-center justify-center gap-3 bg-red-600 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-red-700 transition-all mb-4"
          >
            {checking ? "Checking..." : "Verify Re-payment"}
            <RefreshCw size={18} className={checking ? "animate-spin" : ""} />
          </button>

          <button
            onClick={logout}
            className="text-[10px] font-black text-red-600/70 uppercase tracking-widest hover:text-red-600 transition-colors"
          >
            Switch Account
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {children}
    </>
  );
}
