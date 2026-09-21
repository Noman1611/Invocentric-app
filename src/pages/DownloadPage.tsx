import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Logo } from '../components/Logo';
import { 
  Download, 
  Monitor, 
  Smartphone, 
  Globe, 
  CheckCircle2, 
  ShieldCheck, 
  HardDrive, 
  Sparkles, 
  ArrowRight, 
  HelpCircle, 
  Printer, 
  Zap, 
  Lock,
  ChevronDown,
  ExternalLink
} from 'lucide-react';

export default function DownloadPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'windows' | 'android' | 'web'>('windows');
  const GITHUB_WINDOWS_URL = 'https://github.com/Noman1611/Invocentric-app/releases/latest/download/InvoCentric-Setup.exe';
  const GITHUB_ANDROID_URL = 'https://github.com/Noman1611/Invocentric-app/releases/latest/download/InvoCentric.apk';

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    }
    return false;
  });

  return (
    <div className="min-h-screen bg-[#FAFCFB] font-sans selection:bg-emerald-500/20 text-slate-800">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="font-brand text-xl tracking-tight text-slate-900">
            <span className="font-extrabold">Invo</span><span className="font-bold">Centric</span>
          </span>
          <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 hidden sm:inline-block">
            Download Hub
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
          >
            Launch Web App
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={14} className="text-emerald-600 animate-pulse" />
            Official Desktop Software &amp; Mobile App
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Download InvoCentric for <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
              Windows PC &amp; Android Phone
            </span>
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-4 leading-relaxed max-w-2xl mx-auto">
            Choose how you want to run your billing: download the 100% private Local PC software for your computer, install the mobile app on your phone, or run directly in your browser.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-semibold text-emerald-800">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-600" /> 14-Day Free Trial Auto-Unlocked</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-600" /> No License Keys Needed</span>
          </div>
        </div>

        {/* Smart Device Detection Quick-Download Banner */}
        <div className="mb-12 p-5 sm:p-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-600/80 rounded-3xl shadow-lg shadow-emerald-900/5 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 text-left w-full md:w-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#0d5c4b] text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-900/20">
              {isMobile ? <Smartphone size={28} /> : <Monitor size={28} />}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-200/80 text-emerald-900 mb-1">
                <Sparkles size={11} />
                {isMobile ? 'Detected: Smartphone / Android' : 'Detected: Windows PC / Laptop'}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {isMobile ? 'Recommended: Install InvoCentric Mobile App' : 'Recommended: Install InvoCentric Windows Software'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {isMobile 
                  ? 'Tap button to directly download and install the APK on your phone like Play Store.' 
                  : 'Click below to download the offline desktop installer with local PC storage.'}
              </p>
            </div>
          </div>
          <div className="w-full md:w-auto shrink-0 flex flex-col items-center">
            <a
              href={isMobile ? GITHUB_ANDROID_URL : GITHUB_WINDOWS_URL}
              download={isMobile ? 'InvoCentric.apk' : 'InvoCentric-Setup.exe'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-auto px-7 py-4 bg-[#0d5c4b] hover:bg-[#09473a] text-white text-xs sm:text-sm font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer text-center"
            >
              <Download size={18} />
              <span>{isMobile ? 'Download Android APK Now (~1.2MB)' : 'Download Windows (.exe ~112MB)'}</span>
            </a>
            <span className="text-[10px] text-slate-500 mt-1.5 font-medium">
              1-Click Direct Download • Free 14-Day Pro Included
            </span>
          </div>
        </div>

        {/* 3 Main Download Cards Grid (Reordered so Android is First on Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          
          {/* Card: Android Mobile App */}
          <div className={`bg-white border-2 ${isMobile ? 'border-emerald-600 shadow-xl shadow-emerald-900/5 order-first' : 'border-slate-200/80 hover:border-slate-300 md:order-2'} rounded-3xl p-6 sm:p-8 transition-all flex flex-col justify-between relative`}>
            {isMobile && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0d5c4b] text-white px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <Smartphone size={12} /> Best For Your Phone
              </div>
            )}

            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#0d5c4b] flex items-center justify-center mb-5 shadow-inner">
                <Smartphone size={28} />
              </div>
              <h2 className="text-xl font-black text-slate-900">Android Mobile App</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Mobile Application (.apk)</p>
              
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Bill on the go from your Android smartphone. Scan barcodes with camera and share PDF bills instantly on WhatsApp.
              </p>

              <div className="mt-5 space-y-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Direct APK install like Play Store</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Camera Barcode &amp; QR Scanner</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>1-Click WhatsApp Invoice Sharing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Android 8.0, 9, 10, 11, 12, 13, 14+</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <a
                href={GITHUB_ANDROID_URL}
                download="InvoCentric.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-5 bg-[#0d5c4b] hover:bg-[#09473a] text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-emerald-800/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <Download size={16} />
                <span>Download Android App (.apk)</span>
              </a>
              <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
                Direct APK • Size ~1.2MB • Instant Install
              </p>
              <div className="text-center mt-1.5">
                <a 
                  href={GITHUB_ANDROID_URL} 
                  download="InvoCentric.apk" 
                  className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold underline"
                >
                  Direct Link: InvoCentric.apk
                </a>
              </div>
            </div>
          </div>

          {/* Card: Windows PC Desktop Software */}
          <div className={`bg-white border-2 ${!isMobile ? 'border-emerald-600 shadow-xl shadow-emerald-900/5 md:order-1' : 'border-slate-200/80 hover:border-slate-300 order-2'} rounded-3xl p-6 sm:p-8 transition-all flex flex-col justify-between relative`}>
            {!isMobile && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0d5c4b] text-white px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <HardDrive size={12} /> Most Popular for Retail PC
              </div>
            )}

            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5 shadow-inner">
                <Monitor size={28} />
              </div>
              <h2 className="text-xl font-black text-slate-900">Windows PC Edition</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Desktop Software (.exe)</p>
              
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Complete GST billing software with 100% local PC offline storage. Your financial data stays only on your computer.
              </p>

              <div className="mt-5 space-y-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>100% Local PC Storage (Zero Cloud Leak)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>2" &amp; 3" Thermal Receipt Printers Support</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Works completely Offline without Internet</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Windows 11, 10, 8.1 (64-bit)</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <a
                href={GITHUB_WINDOWS_URL}
                download="InvoCentric-Setup.exe"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-5 bg-[#0d5c4b] hover:bg-[#09473a] text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-emerald-800/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <Download size={16} />
                <span>Download for Windows (.exe)</span>
              </a>
              <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
                Version 1.0.1 • Size ~112MB • Windows Installer
              </p>
              <div className="text-center mt-1.5">
                <a 
                  href={GITHUB_WINDOWS_URL} 
                  download="InvoCentric-Setup.exe" 
                  className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold underline"
                >
                  Direct Link: InvoCentric-Setup.exe
                </a>
              </div>
            </div>
          </div>

          {/* Card 3: Cloud Web App (Browser Edition) */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between order-3">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#0d5c4b] flex items-center justify-center mb-5 shadow-inner">
                <Globe size={28} />
              </div>
              <h2 className="text-xl font-black text-slate-900">Cloud Web Edition</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Online in Browser</p>
              
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                No installation needed. Run InvoCentric directly in Google Chrome, Edge, Safari or Firefox from any computer or laptop.
              </p>

              <div className="mt-5 space-y-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Zero Installation • Opens Instantly</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Automatic Cloud Backup &amp; Sync</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Works on Mac, Windows, Linux, iPad</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>PWA Desktop Install Available</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <Link
                to="/login"
                className="w-full py-3.5 px-5 bg-slate-900 hover:bg-slate-950 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowRight size={16} />
                <span>Launch in Browser</span>
              </Link>
              <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
                Web Access • Any modern browser
              </p>
            </div>
          </div>

        </div>

        {/* 3 Simple Steps to Get Started */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 mb-16 shadow-xl shadow-slate-900/5">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[#0d5c4b] text-[11px] font-black uppercase tracking-wider mb-3">
              Quick Setup Guide
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              How to Install & Get Started in 3 Steps
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              No complicated setup. You will be ready to print your first invoice in under 2 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-200/90 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#0d5c4b] text-white font-black flex items-center justify-center mb-4 text-base shadow-sm">
                  1
                </div>
                <h4 className="font-bold text-base text-slate-900 mb-2 tracking-tight">Download & Run Installer</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Click "Download for Windows" above to get the setup file. Double click to run the installer on your PC.
                </p>
              </div>
            </div>

            <div className="bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-200/90 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#0d5c4b] text-white font-black flex items-center justify-center mb-4 text-base shadow-sm">
                  2
                </div>
                <h4 className="font-bold text-base text-slate-900 mb-2 tracking-tight">Login with your Email</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Open InvoCentric on your desktop and enter your Email ID. Your <strong className="text-slate-800 font-semibold">14-Day Free Pro Trial</strong> activates instantly with zero license keys.
                </p>
              </div>
            </div>

            <div className="bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-200/90 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#0d5c4b] text-white font-black flex items-center justify-center mb-4 text-base shadow-sm">
                  3
                </div>
                <h4 className="font-bold text-base text-slate-900 mb-2 tracking-tight">Start Billing & Printing</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Add your business name, create GST bills, print thermal receipts, or scan barcodes — fully offline or online!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Tips (Windows & Android) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {/* Android Tip */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Smartphone size={22} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Notice for Android APK Installation:</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                When downloading APK files outside Play Store, Chrome may say <em>"File might be harmful"</em>. Simply tap <strong>"Download anyway"</strong>, open the APK file, and tap <strong>"Install"</strong>. If prompted, allow <em>"Install from unknown sources"</em>. InvoCentric APK is 100% verified, virus-free, and official.
              </p>
            </div>
          </div>

          {/* Windows SmartScreen Tip */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <HelpCircle size={22} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Notice for Windows PC Installation:</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                When installing on Windows, Defender SmartScreen may show <em>"Windows protected your PC"</em>. Simply click on <strong>"More info"</strong> and then click <strong>"Run anyway"</strong>. InvoCentric is 100% safe, verified, and malware-free.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} InvoCentric. Made with pride for Indian Small Businesses & Traders.</p>
        <div className="mt-2 flex items-center justify-center gap-4 font-medium">
          <Link to="/" className="hover:text-emerald-700">Home</Link>
          <Link to="/pricing" className="hover:text-emerald-700">Pricing</Link>
          <Link to="/terms" className="hover:text-emerald-700">Terms & Privacy</Link>
          <Link to="/blog" className="hover:text-emerald-700">GST Guides</Link>
        </div>
      </footer>
    </div>
  );
}
