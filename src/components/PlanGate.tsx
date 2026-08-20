import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldAlert, RefreshCw, LogIn, Globe, Wifi, WifiOff } from 'lucide-react';
import { Logo } from './Logo';

export function PlanGate({ children }: { children: React.ReactNode }) {
  const { user, planStatus, loading, refreshUserData, logout, isOfflineMode } = useAuth();
  const location = useLocation();
  const [mustCheckOnline, setMustCheckOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkDailyReauth = () => {
      const today = new Date().toDateString();
      const lastCheck = localStorage.getItem('last_plan_check_date');
      
      if (lastCheck !== today) {
        setMustCheckOnline(true);
      }
    };

    checkDailyReauth();
    // Re-check every hour while app is open
    const interval = setInterval(checkDailyReauth, 3600000);
    return () => clearInterval(interval);
  }, [user]);

  const handleVerify = async () => {
    setChecking(true);
    try {
      // Check if we can reach the internet
      if (!navigator.onLine) {
        alert("Please connect to the internet to verify your plan.");
        return;
      }
      await refreshUserData();
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
          <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tight mb-2">Daily Verification</h2>
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] mb-8 leading-relaxed">
            Naya din, naya check! Aapka plan verify karne ke liye 1 baar online aana zaroori hai.
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
