import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { RotateCcw, ArrowRight, Download, CheckCircle2, ShieldCheck, Printer } from 'lucide-react';

export default function ThermalPreviewPage() {
  const [searchParams] = useSearchParams();
  const [animKey, setAnimKey] = useState(0);

  const businessName = searchParams.get('name') || 'Business Partner';
  const lastLoginDate = searchParams.get('date') || 'Recently';
  const daysInactive = searchParams.get('days') || '3 Days';
  const invoiceCount = searchParams.get('invoices') || '128';
  const stockCount = searchParams.get('stock') || '45 Items';
  const dueCount = searchParams.get('due') || '₹8,450';
  const customerCount = searchParams.get('customers') || '64';

  const handleReprint = () => {
    setAnimKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#c8d3ce] py-8 px-4 flex flex-col items-center justify-start font-sans antialiased">
      {/* Top action toolbar */}
      <div className="max-w-[520px] w-full flex items-center justify-between mb-4">
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0d5c4b] bg-white/90 hover:bg-white px-3 py-1.5 rounded-full shadow-xs transition-all"
        >
          <ArrowRight size={13} className="rotate-180" />
          <span>Home</span>
        </Link>

        <button
          onClick={handleReprint}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0d5c4b] hover:bg-[#0a483a] px-3.5 py-1.5 rounded-full shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>⚡ Re-print Animation</span>
        </button>
      </div>

      {/* Main Printer Machine Container */}
      <div className="max-w-[520px] w-full shadow-2xl rounded-2xl overflow-hidden bg-transparent">
        {/* POS PRINTER MACHINE HEAD */}
        <div className="w-full h-12 bg-gradient-to-b from-[#1b2229] via-[#29343f] to-[#151b22] rounded-t-xl shadow-lg flex items-center px-4 justify-between border-b border-black/40 relative z-20">
          {/* LED Status Light */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_#2ecc71]"></span>
            </span>
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-emerald-400">
              PRINTER ONLINE
            </span>
          </div>

          {/* Paper Discharge Slot */}
          <div className="h-2 bg-[#090c0e] rounded-full border-b border-white/20 flex-1 max-w-[280px] mx-4 shadow-inner" />

          {/* Machine Brand Mark */}
          <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Printer size={12} className="text-emerald-400" />
            <span>80MM POS</span>
          </div>
        </div>

        {/* THERMAL PAPER RECEIPT SLIP WITH ANIMATION */}
        <div className="w-full relative overflow-hidden bg-transparent pt-0">
          <div 
            key={animKey}
            style={{
              animation: 'thermalPrintFeed 3.2s cubic-bezier(0.25, 1, 0.4, 1) forwards'
            }}
            className="w-full bg-white shadow-xl border-x border-slate-300 border-b-4 border-dashed border-b-[#b9d4ca] p-6 sm:p-8"
          >
            {/* Header / Brand */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-[#0d5c4b]/10 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 500 500" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
                  <g fill="#0d5c4b">
                    <path d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9 c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87 c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3 c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3 C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
                    <ellipse cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
                    <path d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6 c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50 C362.6,181.5,340.3,178.8,324.8,191z"/>
                  </g>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#0d5c4b] tracking-tight leading-none">InvoCentric</h1>
                <p className="text-[11px] text-[#0d5c4b] font-medium mt-1">More than billing. Built for your business.</p>
              </div>
            </div>

            {/* Sub-header divider */}
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 border-t border-dashed border-slate-300" />
              <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">BUSINESS SUMMARY</span>
              <div className="flex-1 border-t border-dashed border-slate-300" />
            </div>

            {/* Headline */}
            <div className="mb-4">
              <h2 className="text-xl font-extrabold text-[#0d5c4b] leading-tight">
                Your Business Has Been Waiting!
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Hi <strong className="text-slate-900">{businessName}</strong>, your billing dashboard, inventory records, and receipts are ready and waiting.
              </p>
            </div>

            {/* Activity Box */}
            <div className="bg-[#e3f1ec] rounded-xl p-4 my-4 flex items-center justify-between border border-[#b9d4ca]/50">
              <div className="flex-1">
                <span className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider block">Last Activity</span>
                <span className="text-sm font-black text-[#0d5c4b]">{lastLoginDate}</span>
              </div>
              <div className="w-[1px] h-8 bg-[#b9d4ca] mx-4" />
              <div className="flex-1">
                <span className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider block">Days Inactive</span>
                <span className="text-sm font-black text-[#0d5c4b]">{daysInactive}</span>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="space-y-3 py-2 border-b border-slate-200">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">Total Invoices</span>
                  <span className="text-[10px] text-slate-500">Completed & Saved</span>
                </div>
                <span className="font-black text-[#0d5c4b] text-sm">{invoiceCount}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">Inventory Tracked</span>
                  <span className="text-[10px] text-slate-500">Products & Catalog</span>
                </div>
                <span className="font-black text-[#0d5c4b] text-sm">{stockCount}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">Pending Outstanding</span>
                  <span className="text-[10px] text-slate-500">Recoverable Dues</span>
                </div>
                <span className="font-black text-[#0d5c4b] text-sm">{dueCount}</span>
              </div>

              <div className="flex items-center justify-between py-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">Linked Customers</span>
                  <span className="text-[10px] text-slate-500">Active Client Directory</span>
                </div>
                <span className="font-black text-[#0d5c4b] text-sm">{customerCount}</span>
              </div>
            </div>

            {/* Action CTA Button */}
            <div className="mt-6 text-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-[#0d5c4b] hover:bg-[#0a483a] text-white font-black text-xs uppercase tracking-wider shadow-lg transition-transform active:scale-95"
              >
                <span>OPEN INVOCENTRIC</span>
                <ArrowRight size={14} />
              </Link>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">
                Your data is safe, encrypted, and backed up.
              </p>
            </div>

            {/* Thermal Barcode Stamp */}
            <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-center">
              <div className="font-mono text-[9px] text-slate-500 tracking-widest uppercase mb-1">
                SECURE THERMAL CLOUD DISPATCH
              </div>
              <div className="text-[11px] font-bold text-[#0d5c4b]">
                InvoCentric &bull; High-Speed POS & Billing
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Animation Styles */}
      <style>{`
        @keyframes thermalPrintFeed {
          0% { transform: translateY(-88%); opacity: 0.1; }
          18% { transform: translateY(-70%); opacity: 1; }
          36% { transform: translateY(-52%); }
          54% { transform: translateY(-34%); }
          72% { transform: translateY(-16%); }
          90% { transform: translateY(0); }
          95% { transform: translateY(4px); }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
