import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Scale, Shield, FileText, Cookie, Lock, CheckCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo';

type TabType = 'terms' | 'privacy' | 'cookies';

export default function TermsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('terms');

  useEffect(() => {
    // Determine initial tab from URL hash
    const hash = location.hash.replace('#', '');
    if (hash === 'privacy' || hash === 'cookies' || hash === 'terms') {
      setActiveTab(hash as TabType);
    } else {
      setActiveTab('terms');
    }
    window.scrollTo(0, 0);
  }, [location.hash]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`/terms#${tab}`);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-green-500/20 selection:text-green-900 transition-colors duration-300 bg-[#F8FAFB] text-slate-900">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-gray-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 md:px-16 lg:px-24 h-20 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-bold transition-colors text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>
          
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Logo size={32} />
            <span className="font-brand text-xl tracking-tight text-gray-900">
              <span className="font-extrabold">Invo</span><span className="font-bold">Centric</span>
            </span>
          </div>

          <div className="w-24 hidden md:block" /> {/* Spacer for alignment */}
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-12 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 md:px-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-green-50 text-green-600">
            {activeTab === 'terms' && <Scale size={32} />}
            {activeTab === 'privacy' && <Lock size={32} />}
            {activeTab === 'cookies' && <Cookie size={32} />}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
            {activeTab === 'terms' && 'Terms of Service'}
            {activeTab === 'privacy' && 'Privacy Policy'}
            {activeTab === 'cookies' && 'Cookie Policy'}
          </h1>
          <p className="text-base max-w-2xl mx-auto text-gray-500 font-medium">
            {activeTab === 'terms' && 'Please read these terms and conditions carefully before using our software. Compliant with Indian laws.'}
            {activeTab === 'privacy' && 'We are committed to safeguarding your retail business records and client privacy under the IT Act, 2000.'}
            {activeTab === 'cookies' && 'Learn how we utilize persistent browser local storage to enable ultra-fast, offline-first invoicing.'}
          </p>

          {/* Dynamic Tab Switcher */}
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {(['terms', 'privacy', 'cookies'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab 
                    ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' 
                    : 'bg-gray-50 text-gray-500 hover:text-gray-900 border border-gray-100'
                }`}
              >
                {tab === 'terms' && 'Terms of Service'}
                {tab === 'privacy' && 'Privacy Policy'}
                {tab === 'cookies' && 'Cookie Policy'}
              </button>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-center gap-4 text-xs font-semibold text-gray-500">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50">
              <FileText size={12} /> Last Updated: July 2026
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50">
              <Shield size={12} /> Indian IT Act Compliant
            </span>
          </div>
        </div>
      </section>

      {/* Main Content with Spacious Layout */}
      <main className="py-16">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 md:px-16">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 md:p-12 rounded-[32px] border border-gray-100 shadow-[0_20px_40px_rgba(0,0,0,0.02)] space-y-8 leading-relaxed bg-white text-gray-600 font-medium text-sm shadow-sm"
          >
            <AnimatePresence mode="wait">
              {activeTab === 'terms' && (
                <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">1. Acceptance of Terms</h2>
                    <p>
                      Welcome to InvoCentric. These Terms of Service govern your access to and use of the InvoCentric offline-first invoicing web application. By logging in or using our service, you agree to be bound legally by these terms, which represent a binding contract under the <strong>Indian Contract Act, 1872</strong>.
                    </p>
                  </section>
                  
                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">2. Business Verification & Accounts</h2>
                    <p>
                      Under the <strong>Information Technology Act, 2000</strong>, you must provide authentic details during registration. You represent that your shop name, trade records, and GSTIN details are 100% legal. You are solely responsible for protecting account credentials.
                    </p>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">3. Free Use License & Proposed Pricing</h2>
                    <p>
                      The standard offline-first invoicing modules of InvoCentric are currently offered <strong>completely free of charge</strong>.
                    </p>
                    <p>
                      However, to maintain security servers and expand real-time cloud synchronization, we reserve the right to offer optional premium plans in the future. The suggested pricing is <strong>₹199 per month</strong>, which will be notified to users at least 15 days in advance.
                    </p>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">4. Limitation of Liability</h2>
                    <p>
                      InvoCentric operates as a billing tool. We are not responsible for accounting discrepancies, incorrect tax filings, loss of offline local storage data due to clearing browser caches, or thermal printer physical hardware faults.
                    </p>
                  </section>
                </motion.div>
              )}

              {activeTab === 'privacy' && (
                <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">1. Data Ownership</h2>
                    <p>
                      Your invoices, customer listings, stock levels, and daily books are 100% yours. InvoCentric does not rent, sell, or analyze your transactional trade logs. Your records reside directly in your browser's private local database, synced securely using end-to-end encrypted tunnels.
                    </p>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">2. Information Collection Compliance</h2>
                    <p>
                      Our practices comply with the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data) Rules, 2011</strong>. We only collect the email address and business name needed to activate cloud syncing.
                    </p>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">3. Offline Security Safeguards</h2>
                    <p>
                      Since InvoCentric works 100% offline, your data remains stored locally on your device storage. To ensure maximum data privacy, always secure your computer or smartphone with a lock pattern or PIN code.
                    </p>
                  </section>
                </motion.div>
              )}

              {activeTab === 'cookies' && (
                <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">1. Browser Storage Mechanics</h2>
                    <p>
                      Unlike legacy cloud sites, InvoCentric utilizes browser <strong>Local Storage</strong> and <strong>IndexedDB</strong> technologies instead of tracking cookies. This allows the system to save products, calculate live tax brackets, and compile thermal bill PDFs even if your shop has no internet connection.
                    </p>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">2. Persistent Preferences</h2>
                    <p>
                      We utilize highly secure, local-only state flags to remember:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-500">
                      <li>Your preferred thermal paper width (2-inch or 3-inch)</li>
                      <li>Selected active layout mode (Shop Vyapar vs Freelancer)</li>
                      <li>Selected currency symbols and tax settings</li>
                    </ul>
                  </section>

                  <section className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">3. Recommendations</h2>
                    <p>
                      Do not run aggressive cache-cleaning software or browser "system optimizer" extensions on InvoCentric, as they may clear your local offline-saved invoices before they have synchronized with the cloud backend.
                    </p>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-8 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Patan, Gujarat, India</span>
              <button 
                onClick={() => navigate('/')} 
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Accept & Go Home
              </button>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center transition-colors bg-white border-gray-100 text-gray-500">
        <p className="text-xs font-medium">
          &copy; {new Date().getFullYear()} InvoCentric. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
