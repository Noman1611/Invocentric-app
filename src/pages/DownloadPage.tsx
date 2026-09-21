import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
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
  ExternalLink,
  X,
  QrCode
} from 'lucide-react';

export default function DownloadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'windows' | 'android' | 'web'>('windows');
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  useEffect(() => {
    if (searchParams.get('platform') === 'android' || searchParams.get('guide') === 'open') {
      setShowAndroidModal(true);
    }
  }, [searchParams]);

  const GITHUB_WINDOWS_URL = 'https://github.com/Noman1611/Invocentric-app/releases/latest/download/InvoCentric-Setup.exe';
  const GITHUB_ANDROID_URL = 'https://github.com/Noman1611/Invocentric-app/releases/latest/download/InvoCentric.apk';

  const handleDownload = (platform: 'windows' | 'android') => {
    if (platform === 'windows') {
      // Official high-speed download route with automatic cloud redirect
      window.location.href = '/api/download?platform=windows';
    } else {
      setShowAndroidModal(true);
    }
  };

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
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={14} className="text-emerald-600 animate-pulse" />
            Official Desktop Software & Mobile App
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Download InvoCentric for <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
              Windows PC & Android Phone
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

        {/* 3 Main Download Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          
          {/* Card 1: Windows PC Desktop Software (Featured) */}
          <div className="bg-white border-2 border-emerald-600 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-900/5 relative flex flex-col justify-between">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0d5c4b] text-white px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
              <HardDrive size={12} /> Most Popular for Retail
            </div>

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
                  <span>2" & 3" Thermal Receipt Printers Support</span>
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
              <button
                onClick={() => handleDownload('windows')}
                className="w-full py-3.5 px-5 bg-[#0d5c4b] hover:bg-[#09473a] text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-emerald-800/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={16} />
                <span>Download for Windows (.exe)</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
                Version 1.0.0 • Size ~75MB • Installer
              </p>
            </div>
          </div>

          {/* Card 2: Android Mobile App */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mb-5 shadow-inner">
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
                  <span>Camera Barcode & QR Scanner</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>1-Click WhatsApp Invoice Sharing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Realtime Sync with PC & Tablet</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Android 8.0 or higher</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => handleDownload('android')}
                className="w-full py-3.5 px-5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone size={16} />
                <span>Use on Android Phone (Install)</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
                PWA WebAPK • Works 100% Offline • Camera Scanner
              </p>
            </div>
          </div>

          {/* Card 3: Cloud Web App (Browser Edition) */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mb-5 shadow-inner">
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
                  <span>Automatic Cloud Backup & Sync</span>
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
                className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
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
        <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-3xl p-8 sm:p-12 mb-16 shadow-xl">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h3 className="text-2xl font-black">How to Install & Get Started in 3 Steps</h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-2">No complicated setup. You will be ready to print your first invoice in under 2 minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-black flex items-center justify-center mb-4 text-lg">
                1
              </div>
              <h4 className="font-bold text-base mb-2">Download & Run Installer</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Click "Download for Windows" above to get the setup file. Double click to run the installer on your PC.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-black flex items-center justify-center mb-4 text-lg">
                2
              </div>
              <h4 className="font-bold text-base mb-2">Login with your Email</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Open InvoCentric on your desktop and enter your Email ID. Your <strong>14-Day Free Pro Trial</strong> activates instantly with zero license keys.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-black flex items-center justify-center mb-4 text-lg">
                3
              </div>
              <h4 className="font-bold text-base mb-2">Start Billing & Printing</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Add your business name, create GST bills, print thermal receipts, or scan barcodes — fully offline or online!
              </p>
            </div>
          </div>
        </div>

        {/* Windows SmartScreen Installation Tip */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-16 flex flex-col sm:flex-row items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <HelpCircle size={22} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900">Notice for First-Time Windows Installation (SmartScreen):</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              When installing any new Windows software, Windows Defender SmartScreen may display a prompt saying <em>"Windows protected your PC"</em>. Simply click on <strong>"More info"</strong> and then click <strong>"Run anyway"</strong>. InvoCentric is 100% safe, verified, and malware-free.
            </p>
          </div>
        </div>

        {/* Android Installation Guidance Modal */}
        <AnimatePresence>
          {showAndroidModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 relative"
              >
                <button
                  onClick={() => setShowAndroidModal(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Install on Android Phone</h3>
                    <p className="text-xs text-slate-500 font-medium">Fast, offline & instant install</p>
                  </div>
                </div>

                {/* QR Code for Desktop Users to Scan with Phone */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-sm">
                    <QRCodeSVG value="https://invocentric.in/login" size={130} />
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 mt-2.5 flex items-center gap-1.5">
                    <QrCode size={13} className="text-teal-600" /> Scan with your phone camera to open
                  </p>
                  <p className="text-[10px] text-slate-500">Opens https://invocentric.in directly on your phone</p>
                </div>

                {/* 3 Step Instructions */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2.5 text-xs text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</div>
                    <p>Phone ke <strong>Google Chrome</strong> browser me <strong>invocentric.in</strong> kholein.</p>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</div>
                    <p>Top right me <strong>3 dots (⋮)</strong> menu tap karein aur <strong>"Install app"</strong> ya <strong>"Add to Home Screen"</strong> chunein.</p>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</div>
                    <p>InvoCentric app aapke phone me install ho jayegi — Camera barcode scanner aur offline billing ready!</p>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setShowAndroidModal(false)}
                    className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-teal-900/10 flex items-center justify-center gap-2"
                  >
                    <Zap size={15} />
                    <span>Open Mobile App Now</span>
                  </Link>

                  <button
                    onClick={() => setShowAndroidModal(false)}
                    className="w-full py-2 px-4 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
