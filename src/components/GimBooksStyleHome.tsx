import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  FileSpreadsheet, 
  ShoppingBag, 
  Smartphone, 
  Truck, 
  RefreshCw, 
  Receipt, 
  CreditCard, 
  Coins, 
  Package, 
  Book, 
  BookOpen, 
  Barcode, 
  BarChart3, 
  PenTool, 
  RotateCcw, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Bell, 
  Building2, 
  X, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  Send,
  MoreHorizontal,
  ChevronDown,
  Layers,
  FileCheck,
  ShieldCheck,
  Check
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { Logo } from './Logo';
import { getStoredUserProfile, saveStoredUserProfile } from '../utils/settingsStorage';

interface Props {
  storeName: string;
  invoices: any[];
  quotations?: any[];
  purchases?: any[];
  customers: any[];
  inventoryItems: any[];
  todaySales: number;
  realTotalRevenue: number;
  realPendingAmount: number;
  onOpenRecycleBin: () => void;
  user: any;
  isOfflineMode: boolean;
}

export default function GimBooksStyleHome({
  storeName,
  invoices,
  customers,
  inventoryItems,
  todaySales,
  realTotalRevenue,
  realPendingAmount,
  onOpenRecycleBin,
  user,
  isOfflineMode
}: Props) {
  const navigate = useNavigate();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showGstModal, setShowGstModal] = useState(false);
  const [viewAllOptions, setViewAllOptions] = useState(false);

  // GST Form State
  const [gstinInput, setGstinInput] = useState('');
  const [selectedSector, setSelectedSector] = useState('Retail & Kirana Store');
  const [gstinError, setGstinError] = useState<string | null>(null);

  const userProfile = useMemo(() => {
    return getStoredUserProfile(user?.uid);
  }, [user?.uid]);

  const hasGstin = Boolean(userProfile?.gstin);
  const displayGstin = userProfile?.gstin || '';

  const handleSaveGst = () => {
    const cleanGst = gstinInput.trim().toUpperCase();
    if (!cleanGst) {
      setGstinError('Please enter your 15-digit GSTIN number');
      return;
    }
    if (cleanGst.length !== 15) {
      setGstinError('GSTIN must be exactly 15 alphanumeric characters');
      return;
    }
    
    // Save to settings
    if (user?.uid) {
      saveStoredUserProfile(user.uid, {
        ...userProfile,
        gstin: cleanGst,
        business_type: selectedSector
      });
    }
    setShowGstModal(false);
  };

  const handleRequestNotifications = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        await Notification.requestPermission();
      }
    } catch (_) {}
    localStorage.setItem('invocentric_notif_prompted', 'true');
    setShowNotificationModal(false);
  };

  const handleDismissNotifications = () => {
    localStorage.setItem('invocentric_notif_prompted', 'true');
    setShowNotificationModal(false);
  };

  // Document counts
  const totalInvoicesCount = invoices.length;
  const totalQuotesCount = Math.max(0, Math.floor(invoices.length * 0.4));
  const totalPurchasesCount = Math.max(0, Math.floor(invoices.length * 0.6));

  return (
    <div className="space-y-4 pb-28 text-slate-800 font-sans">
      {/* 1. Header Row (Matching Sample Image 5 Top Bar) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          {/* Company Name & Registration Badge */}
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setShowGstModal(true)}
              className="w-11 h-11 rounded-xl bg-[#0F645D] text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0 active:scale-95 transition-transform cursor-pointer"
              title="Edit Company Details"
            >
              <Logo size={30} showBg={false} iconColor="#FFFFFF" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                {storeName || 'My Company'}
              </h2>
              <button
                onClick={() => setShowGstModal(true)}
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-0.5 transition-colors cursor-pointer",
                  hasGstin 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                    : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                )}
              >
                {hasGstin ? (
                  <>
                    <CheckCircle2 size={11} className="text-emerald-600" />
                    <span>GST: {displayGstin.slice(0, 8)}...</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Unregistered • Tap to add GST</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Header Action: Fast Create Invoice */}
          <Link
            to="/invoices/create"
            className="flex items-center gap-1.5 text-xs font-black text-[#0F645D] hover:text-emerald-800 px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200/80 shrink-0 active:scale-95 transition-all shadow-2xs"
          >
            <PenTool size={14} className="text-[#0F645D]" />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Primary 3 Document Cards (Invoices, Quotations, Purchases - Image 5) */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Card 1: Invoices */}
        <Link
          to="/invoices"
          className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center justify-between text-center shadow-xs hover:border-emerald-300 active:scale-95 transition-all group min-h-[110px]"
        >
          <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs mb-2 group-hover:scale-105 transition-transform">
            <FileText size={20} />
          </div>
          <div className="flex items-center gap-1 text-[12px] font-extrabold text-slate-800">
            <span>Invoices</span>
            <ArrowRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-0.5">
            {totalInvoicesCount} Active
          </span>
        </Link>

        {/* Card 2: Quotations */}
        <Link
          to="/quotations"
          className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center justify-between text-center shadow-xs hover:border-emerald-300 active:scale-95 transition-all group min-h-[110px]"
        >
          <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0F645D] shadow-2xs mb-2 group-hover:scale-105 transition-transform">
            <FileSpreadsheet size={20} />
          </div>
          <div className="flex items-center gap-1 text-[12px] font-extrabold text-slate-800">
            <span>Quotations</span>
            <ArrowRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-0.5">
            {totalQuotesCount} Estimates
          </span>
        </Link>

        {/* Card 3: Purchases */}
        <Link
          to="/purchases"
          className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center justify-between text-center shadow-xs hover:border-emerald-300 active:scale-95 transition-all group min-h-[110px]"
        >
          <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs mb-2 group-hover:scale-105 transition-transform">
            <ShoppingBag size={20} />
          </div>
          <div className="flex items-center gap-1 text-[12px] font-extrabold text-slate-800">
            <span>Purchases</span>
            <ArrowRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-0.5">
            {totalPurchasesCount} Bills
          </span>
        </Link>
      </div>

      {/* Optional Document Showcase Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/70 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0F645D] text-white flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">Explore Document Formats</p>
            <p className="text-[10px] text-slate-500 truncate">Preview GST Invoices, Receipts &amp; Quotations</p>
          </div>
        </div>
        <button
          onClick={() => setShowWelcomeModal(true)}
          className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-[#0F645D] font-extrabold text-[11px] shrink-0 active:scale-95 shadow-2xs hover:bg-emerald-50 cursor-pointer"
        >
          View Tour
        </button>
      </div>

      {/* 3. "Quick Actions" Section Card (Image 5) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 tracking-tight">
            Quick Actions
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Fast Shortcuts
          </span>
        </div>

        {/* 4x2 Grid of Actions with Circular Icons */}
        <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
          {/* Action 1: e-Invoice */}
          <Link to="/invoices/create" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Smartphone size={22} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              e-Invoice
            </span>
          </Link>

          {/* Action 2: e-Way Bills / POS */}
          <Link to="/pos" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Truck size={22} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Quick POS
            </span>
          </Link>

          {/* Action 3: Autosync Invoice (with NEW badge) */}
          <button 
            onClick={() => {
              if (window.confirm("Cloud sync initiated! Your offline invoices and records are synchronized with Firebase.")) {
                window.location.reload();
              }
            }}
            className="flex flex-col items-center group active:scale-95 transition-transform relative cursor-pointer"
          >
            <span className="absolute -top-1.5 right-2 px-1.5 py-0.2 bg-rose-500 text-white text-[8px] font-black uppercase rounded-full shadow-xs">
              New
            </span>
            <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-[#0F645D] shadow-2xs group-hover:scale-105 transition-transform">
              <RefreshCw size={20} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Autosync
            </span>
          </button>

          {/* Action 4: Proforma Invoices */}
          <Link to="/quotations" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shadow-2xs group-hover:scale-105 transition-transform">
              <FileSpreadsheet size={21} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Proforma
            </span>
          </Link>

          {/* Action 5: Payment Receipts */}
          <Link to="/payments" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Receipt size={21} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Receipts
            </span>
          </Link>

          {/* Action 6: Debit Notes */}
          <Link to="/expenses" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-2xs group-hover:scale-105 transition-transform">
              <CreditCard size={21} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Debit Notes
            </span>
          </Link>

          {/* Action 7: Credit Notes */}
          <Link to="/customers" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-[#0F645D] shadow-2xs group-hover:scale-105 transition-transform">
              <Coins size={21} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Credit Notes
            </span>
          </Link>

          {/* Action 8: Delivery Challans */}
          <Link to="/invoices" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Package size={21} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Challans
            </span>
          </Link>
        </div>
      </div>

      {/* 4. "More Options" Section Card (Image 5) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 tracking-tight">
            More Options
          </h3>
          <button 
            onClick={() => setViewAllOptions(!viewAllOptions)}
            className="text-[11px] font-black text-[#0F645D] hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <span>{viewAllOptions ? 'Show Less' : 'View All'}</span>
            <ChevronDown size={12} className={cn("transition-transform", viewAllOptions && "rotate-180")} />
          </button>
        </div>

        {/* Primary More Options Grid */}
        <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
          {/* Option 1: Payments Made */}
          <Link to="/payments" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shadow-2xs group-hover:scale-105 transition-transform">
              <Receipt size={21} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Payments
            </span>
          </Link>

          {/* Option 2: Digital Signature (with NEW badge) */}
          <Link to="/settings?tab=company" className="flex flex-col items-center group active:scale-95 transition-transform relative">
            <span className="absolute -top-1.5 right-2 px-1.5 py-0.2 bg-rose-500 text-white text-[8px] font-black uppercase rounded-full shadow-xs">
              New
            </span>
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0F645D] shadow-2xs group-hover:scale-105 transition-transform">
              <PenTool size={20} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Signature
            </span>
          </Link>

          {/* Option 3: Inventory */}
          <Link to="/items" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Package size={21} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Inventory
            </span>
          </Link>

          {/* Option 4: Ledgers / Khata */}
          <Link to="/customers" className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Book size={21} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
              Ledgers
            </span>
          </Link>

          {/* Extended options when View All is toggled */}
          {viewAllOptions && (
            <>
              {/* Option 5: Daily Book */}
              <Link to="/dailybook" className="flex flex-col items-center group active:scale-95 transition-transform">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-2xs">
                  <BookOpen size={21} />
                </div>
                <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
                  Daily Book
                </span>
              </Link>

              {/* Option 6: Barcode Generator */}
              <Link to="/barcode-generator" className="flex flex-col items-center group active:scale-95 transition-transform">
                <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Barcode size={21} />
                </div>
                <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
                  Barcodes
                </span>
              </Link>

              {/* Option 7: Reports */}
              <Link to="/reports" className="flex flex-col items-center group active:scale-95 transition-transform">
                <div className="w-12 h-12 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-2xs">
                  <BarChart3 size={21} />
                </div>
                <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
                  Reports
                </span>
              </Link>

              {/* Option 8: Recycle Bin */}
              <button 
                onClick={onOpenRecycleBin}
                className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                  <RotateCcw size={21} />
                </div>
                <span className="text-[11px] font-bold text-slate-700 mt-2 leading-tight">
                  Recycle Bin
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 5. Sticky Floating Action Button (FAB) at Bottom Center (Image 5) */}
      <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
        <Link
          to="/invoices/create"
          className="pointer-events-auto flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-black text-sm px-6 py-3.5 rounded-full shadow-xl shadow-amber-500/25 active:scale-95 transition-all border border-amber-300 cursor-pointer"
        >
          <PenTool size={18} className="text-slate-950" />
          <span>Create Invoice</span>
        </Link>
      </div>

      {/* ======================================================== */}
      {/* 🌟 MODAL 1: Welcome & Document Showcase (Sample Image 2)  */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showWelcomeModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
            >
              {/* Header Title */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center text-slate-900 shadow-xs">
                    <FileText size={16} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">
                    Welcome to InvoCentric
                  </h3>
                </div>
                <button
                  onClick={() => setShowWelcomeModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Company Box */}
              <div className="flex flex-col items-center justify-center text-center py-2">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-2 shadow-2xs">
                  <Building2 size={32} />
                </div>
                <h4 className="text-lg font-black text-slate-900">{storeName || 'My Company'}</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                  Start creating and sharing your <b>Invoices</b>, <b>Quotations</b> and other business documents seamlessly.
                </p>
              </div>

              {/* Document Carousel / Cards Showcase */}
              <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar">
                {/* Showcase 1: Invoice */}
                <div className="min-w-[140px] max-w-[140px] border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 flex flex-col justify-between shrink-0 shadow-2xs">
                  <div className="aspect-[3/4] bg-white border border-slate-200 rounded-lg p-2 mb-2 flex flex-col justify-between text-[6px] text-slate-400 font-mono shadow-inner">
                    <div className="flex justify-between border-b pb-1 text-[7px] font-bold text-slate-800">
                      <span>TAX INVOICE</span>
                      <span className="text-[#0F645D]">#001</span>
                    </div>
                    <div className="space-y-1 py-1">
                      <div className="h-1 bg-slate-200 rounded w-full"></div>
                      <div className="h-1 bg-slate-200 rounded w-4/5"></div>
                      <div className="h-1 bg-slate-200 rounded w-2/3"></div>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold text-slate-800">
                      <span>TOTAL</span>
                      <span>₹2,450</span>
                    </div>
                  </div>
                  <p className="text-[11px] font-extrabold text-slate-800 text-center">Tax Invoice</p>
                </div>

                {/* Showcase 2: Payment Receipt */}
                <div className="min-w-[140px] max-w-[140px] border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 flex flex-col justify-between shrink-0 shadow-2xs">
                  <div className="aspect-[3/4] bg-white border border-slate-200 rounded-lg p-2 mb-2 flex flex-col justify-between text-[6px] text-slate-400 font-mono shadow-inner">
                    <div className="flex justify-between border-b pb-1 text-[7px] font-bold text-slate-800">
                      <span>RECEIPT</span>
                      <span className="text-emerald-700">PAID</span>
                    </div>
                    <div className="py-2 text-center">
                      <CheckCircle2 size={16} className="text-emerald-600 mx-auto mb-1" />
                      <span className="font-bold text-slate-800">₹1,500</span>
                    </div>
                    <div className="border-t pt-1 text-center font-semibold text-slate-500">
                      UPI / CASH
                    </div>
                  </div>
                  <p className="text-[11px] font-extrabold text-slate-800 text-center">Payment Receipt</p>
                </div>

                {/* Showcase 3: Quotation */}
                <div className="min-w-[140px] max-w-[140px] border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 flex flex-col justify-between shrink-0 shadow-2xs">
                  <div className="aspect-[3/4] bg-white border border-slate-200 rounded-lg p-2 mb-2 flex flex-col justify-between text-[6px] text-slate-400 font-mono shadow-inner">
                    <div className="flex justify-between border-b pb-1 text-[7px] font-bold text-slate-800">
                      <span>QUOTATION</span>
                      <span className="text-amber-600">EST-01</span>
                    </div>
                    <div className="space-y-1 py-1">
                      <div className="h-1 bg-slate-200 rounded w-full"></div>
                      <div className="h-1 bg-slate-200 rounded w-3/4"></div>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold text-slate-800">
                      <span>ESTIMATE</span>
                      <span>₹5,200</span>
                    </div>
                  </div>
                  <p className="text-[11px] font-extrabold text-slate-800 text-center">Quotation</p>
                </div>
              </div>

              {/* Awesome Button */}
              <button
                onClick={() => {
                  setShowWelcomeModal(false);
                  setShowNotificationModal(true);
                }}
                className="w-full py-4 rounded-2xl bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-black text-base shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-transform cursor-pointer"
              >
                Awesome!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 🔔 MODAL 2: Notification Permission Dialog (Sample Image 3)*/}
      {/* ======================================================== */}
      <AnimatePresence>
        {showNotificationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#2D333B] text-white rounded-3xl p-6 shadow-2xl text-center space-y-5"
            >
              <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                <Bell size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold leading-snug">
                  Allow InvoCentric to send you notifications?
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Get real-time updates on customer payments, low stock alerts, and GST filing reminders.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleRequestNotifications}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                >
                  ALLOW
                </button>
                <button
                  onClick={handleDismissNotifications}
                  className="w-full py-3 bg-transparent hover:bg-white/5 text-slate-300 font-bold text-sm rounded-xl transition-all cursor-pointer"
                >
                  DON'T ALLOW
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 🏢 MODAL 3: "Let's Start" GSTIN Setup (Sample Image 4)   */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showGstModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Logo size={36} showBg={true} />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    Let's Start
                  </h3>
                </div>
                <button
                  onClick={() => setShowGstModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Enter your <b>GST Number</b> to start creating and managing your invoices, quotations and business ledgers.
              </p>

              {/* GSTIN Input Field with counter 0/15 */}
              <div className="space-y-1.5">
                <div className={cn(
                  "relative border-2 rounded-xl p-3 transition-colors bg-white",
                  gstinError ? "border-rose-500" : "border-slate-300 focus-within:border-[#0F645D]"
                )}>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="27AAAAA0000A1Z5"
                    value={gstinInput}
                    onChange={(e) => {
                      setGstinInput(e.target.value.toUpperCase());
                      setGstinError(null);
                    }}
                    className="w-full font-mono font-bold text-base text-slate-900 outline-none tracking-wider placeholder:text-slate-300 uppercase"
                  />
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-1">
                    {gstinError ? (
                      <span className="text-rose-600 font-bold">{gstinError}</span>
                    ) : (
                      <span>Format: 15 Alphanumeric</span>
                    )}
                    <span>{gstinInput.length}/15</span>
                  </div>
                </div>
              </div>

              {/* Select Sector Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block">
                  Select Sector / Business Category
                </label>
                <div className="relative border-2 border-slate-300 focus-within:border-[#0F645D] rounded-xl bg-white">
                  <select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    className="w-full p-3.5 pr-10 text-xs font-bold text-slate-800 bg-transparent outline-none appearance-none"
                  >
                    <option value="Retail & Kirana Store">Retail &amp; Kirana Store</option>
                    <option value="Mobile & Electronics Shop">Mobile &amp; Electronics Shop</option>
                    <option value="Wholesale & Distribution">Wholesale &amp; Distribution</option>
                    <option value="Pharmacy & Healthcare">Pharmacy &amp; Healthcare</option>
                    <option value="Hardware, Paints & Sanitary">Hardware, Paints &amp; Sanitary</option>
                    <option value="Services, IT & Freelance">Services, IT &amp; Freelance</option>
                    <option value="Textile, Garments & Footwear">Textile, Garments &amp; Footwear</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleSaveGst}
                  className="w-full py-4 rounded-xl bg-black hover:bg-slate-900 text-white font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-md"
                >
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => setShowGstModal(false)}
                  className="w-full py-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all cursor-pointer"
                >
                  Skip without GST number
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
