import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { WhatsAppIcon } from './WhatsAppIcon';
import {
  ArrowRight, Check, ChevronRight, Download, Monitor, Smartphone,
  Printer, Sparkles, FileText, Store, ShieldCheck, Zap,
  TrendingUp, CreditCard, ExternalLink, QrCode, Star, Award, Headset
} from 'lucide-react';
import {
  DEFAULT_WINDOWS_DOWNLOAD_URL,
  DEFAULT_ANDROID_DOWNLOAD_URL,
  resolveWorkingDownloadUrls,
  triggerDirectDownload
} from '../config/downloadLinks';

export function HeroPreviewPage() {
  const navigate = useNavigate();
  const [downloadUrls, setDownloadUrls] = useState({
    windows: DEFAULT_WINDOWS_DOWNLOAD_URL,
    android: DEFAULT_ANDROID_DOWNLOAD_URL
  });

  React.useEffect(() => {
    let isMounted = true;
    resolveWorkingDownloadUrls().then((res) => {
      if (isMounted) setDownloadUrls(res);
    });
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-900 font-sans selection:bg-emerald-500 selection:text-white antialiased overflow-x-hidden relative">
      
      {/* Top Luxury Bar */}
      <div className="relative z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] uppercase tracking-wider border border-emerald-200 flex items-center gap-1">
            <Sparkles size={11} className="text-emerald-600" /> Apple Light Edition
          </span>
          <span className="text-slate-500 hidden sm:inline">Laptop Workspace, Thermal Hardware &amp; Mobile Scanner Mockups</span>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="text-slate-600 hover:text-slate-900 font-medium underline cursor-pointer bg-transparent border-none text-xs"
        >
          View Landing Page
        </button>
      </div>

      {/* Apple-Style Navigation Header */}
      <header className="relative z-40 max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-9 h-9 rounded-xl bg-slate-900 p-0.5 shadow-md flex items-center justify-center">
            <Logo size={32} />
          </div>
          <span className="font-brand text-2xl tracking-tight text-[#1D1D1F] font-bold">
            Invo<span className="text-emerald-600">Centric</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
          <a href="#hardware" className="hover:text-slate-900 transition-colors">Hardware Sync</a>
          <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
          <button 
            onClick={() => navigate('/download')}
            className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Download size={13} /> Download Offline App
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-[#1D1D1F] hover:bg-[#2D2D2F] text-white font-medium text-xs sm:text-sm rounded-full shadow-md shadow-slate-900/10 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>Get Started Free</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Apple Hero Section with Contained Fluid Background Animation */}
      <section className="relative z-10 pt-8 sm:pt-14 pb-20 md:pb-28 text-center overflow-hidden">
        {/* Dedicated Apple-Style Hero Ambient Background Animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:28px_28px]" />

          <motion.div
            animate={{
              x: [0, 40, -30, 0],
              y: [0, -35, 25, 0],
              scale: [1, 1.15, 0.95, 1],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] md:w-[850px] h-[350px] md:h-[500px] rounded-full bg-gradient-to-br from-emerald-200/40 via-teal-100/35 to-transparent blur-[120px]"
          />

          <motion.div
            animate={{
              x: [0, -35, 25, 0],
              y: [0, 30, -25, 0],
              scale: [0.95, 1.1, 0.9, 0.95],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            className="absolute top-1/4 -left-20 w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-sky-200/30 via-indigo-100/20 to-transparent blur-[110px]"
          />

          <motion.div
            animate={{
              x: [0, 30, -30, 0],
              y: [0, -30, 30, 0],
              scale: [1, 1.12, 0.96, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            className="absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-gradient-to-bl from-teal-200/30 via-emerald-100/30 to-transparent blur-[110px]"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          {/* Top Exclusive Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-slate-200/80 text-slate-700 text-xs font-semibold mb-6 backdrop-blur-md shadow-xs"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-700 uppercase tracking-widest text-[10px] font-bold">PRO OFFER</span>
            <span className="text-slate-600">
              New Merchants Get <strong className="text-emerald-700 font-bold underline decoration-emerald-500/50">30 Days Complimentary Pro Access</strong>
            </span>
            <ChevronRight size={13} className="text-slate-400" />
          </motion.div>

          {/* Grand Luxury Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold tracking-[-0.03em] text-[#1D1D1F] max-w-5xl mx-auto leading-[1.06] mb-6"
          >
            The Gold Standard in <br className="hidden sm:inline" />
            <span className="text-slate-500 font-normal">
              Retail Billing &amp; Accounting
            </span>
          </motion.h1>

          {/* Clean Apple Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-xl text-slate-600 max-w-3xl mx-auto font-normal leading-relaxed mb-10"
          >
            Engineered for high-volume Indian stores, supermarkets, and modern retail counters. Seamless desktop invoicing, instant phone camera barcode scanning, zero-lag thermal printing, and automated WhatsApp delivery.
          </motion.p>

          {/* Primary Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-6"
          >
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#1D1D1F] hover:bg-[#2D2D2F] active:scale-[0.98] text-white font-medium text-base rounded-full shadow-lg shadow-slate-900/10 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span>Claim 30 Days Free Pro Access</span>
              <ArrowRight size={17} />
            </button>

            <a
              href={downloadUrls.windows}
              download="InvoCentric-Setup.exe"
              onClick={(e) => triggerDirectDownload(e, downloadUrls.windows, 'InvoCentric-Setup.exe')}
              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-50 text-[#1D1D1F] border border-slate-200/90 font-medium text-base rounded-full shadow-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Monitor size={17} className="text-slate-600" />
              <span>Download Windows App (.exe)</span>
            </a>
          </motion.div>

          {/* Micro Trust Details */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 font-medium mb-14"
          >
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-600" /> 100% Offline PC Mode</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-600" /> Zero Internet Required</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-600" /> Instant GST Invoicing</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-600" /> Thermal 2" &amp; 3" Support</span>
          </motion.div>

          {/* -------------------- 3D MULTI-DEVICE LUXURY SHOWCASE -------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="relative max-w-6xl mx-auto mt-6"
          >
            {/* Apple Radial Glow Behind Devices */}
            <div className="absolute -inset-10 bg-gradient-to-r from-emerald-500/15 via-teal-400/10 to-sky-400/10 rounded-[60px] blur-3xl -z-10 opacity-70" />

            {/* Central Laptop Showcase */}
            <div className="relative mx-auto flex justify-center">
              <motion.img
                src="https://i.ibb.co/VpJQZX12/006.png"
                alt="InvoCentric Desktop Dashboard"
                className="w-full max-w-[880px] h-auto drop-shadow-[0_24px_50px_rgba(0,0,0,0.18)] filter contrast-[1.02]"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Floating Left: 3D Smartphone Mobile Scanner Mockup - Bold, Extra Large & Prominently Overlapping Laptop Screen */}
              <motion.div
                className="absolute bottom-0 sm:bottom-4 md:bottom-10 lg:bottom-14 -left-4 sm:-left-2 md:left-2 lg:left-6 z-30 w-[45%] max-w-[240px] sm:max-w-[325px] md:max-w-[405px] lg:max-w-[460px]"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <div className="relative group">
                  <img
                    src="https://i.ibb.co/7t1gXWmY/Gemini-Generated-Image-lal0enlal0enlal0-1-Copy.png"
                    alt="InvoCentric Mobile App & Scanner"
                    className="relative w-full h-auto drop-shadow-[0_32px_65px_rgba(0,0,0,0.40)] rounded-3xl"
                  />
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white/95 border border-slate-200 text-slate-800 px-3.5 py-1 rounded-full text-[10px] sm:text-[11px] md:text-xs font-bold tracking-tight shadow-lg whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                    <Smartphone size={14} className="text-emerald-600" />
                    <span>Mobile POS &amp; Barcode Scanner</span>
                  </div>
                </div>
              </motion.div>

              {/* Floating Right: Real Thermal Printer Mockup - Bold, Extra Large & Prominently Overlapping Laptop Screen */}
              <motion.div
                className="absolute bottom-0 sm:bottom-4 md:bottom-8 lg:bottom-12 -right-6 sm:-right-4 md:-right-2 lg:right-2 z-30 w-[43%] max-w-[230px] sm:max-w-[310px] md:max-w-[385px] lg:max-w-[435px]"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
              >
                <div className="relative group">
                  <img
                    src="https://i.ibb.co/b5fwF9hp/Gemini-Generated-Image-p0k2ebp0k2ebp0k2-1.png"
                    alt="Thermal Receipt Printer"
                    className="relative w-full h-auto drop-shadow-[0_32px_65px_rgba(0,0,0,0.36)] rounded-2xl"
                  />
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white/95 border border-slate-200 text-slate-800 px-3.5 py-1 rounded-full text-[10px] sm:text-[11px] md:text-xs font-bold tracking-tight shadow-lg whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                    <Printer size={14} className="text-teal-600" />
                    <span>2" / 3" High-Speed Thermal</span>
                  </div>
                </div>
              </motion.div>

              {/* Floating Top Badge: Apple-Style WhatsApp Delivery */}
              <motion.div
                className="hidden lg:flex items-center gap-2.5 absolute top-6 right-6 lg:right-10 z-30 bg-white/90 border border-slate-200/80 text-slate-800 px-4 py-2.5 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
                  <WhatsAppIcon size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 leading-tight">Instant WhatsApp Bill</p>
                  <p className="text-[10px] text-emerald-600 font-medium">Delivered with PDF in 2 sec</p>
                </div>
              </motion.div>

              {/* Floating Top Left Badge: Apple-Style Offline PC Engine */}
              <motion.div
                className="hidden lg:flex items-center gap-2.5 absolute top-14 left-6 lg:left-10 z-30 bg-white/90 border border-slate-200/80 text-slate-800 px-4 py-2.5 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 leading-tight">100% Offline Mode</p>
                  <p className="text-[10px] text-slate-500 font-medium">Direct PC file storage</p>
                </div>
              </motion.div>

            </div>

          </motion.div>

        </div>
      </section>

      {/* Luxury Trust / Merchant Support Section with Businesswoman Image */}
      <section className="relative z-10 py-16 bg-[#F5F5F7] border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-xl">
            
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="relative shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-4 ring-emerald-500/20 shadow-xl bg-slate-100">
                  <img
                    src="https://i.ibb.co/99TZVmNX/010.png"
                    alt="Dedicated Merchant Support Specialist"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-white" title="Support Online" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-2">
                  <Headset size={12} className="text-emerald-600" /> Dedicated Merchant Concierge
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">
                  Handcrafted Support for India's Leading Businesses
                </h3>
                <p className="text-slate-600 text-sm mt-1 max-w-xl">
                  Direct WhatsApp &amp; phone onboarding with Indian accounting experts. Fast data import, hardware setup, and priority GST assistance.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#1D1D1F] hover:bg-[#2D2D2F] text-white font-medium text-xs sm:text-sm rounded-full shadow-lg shadow-slate-900/10 hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                Claim Free 1-Month Pro
              </button>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}

export default HeroPreviewPage;
