import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  FileSpreadsheet, 
  ShoppingBag, 
  Receipt, 
  CreditCard, 
  Package, 
  Users, 
  Wallet, 
  QrCode, 
  Barcode, 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Search, 
  Building2, 
  X, 
  ChevronRight, 
  Trash2, 
  Settings as SettingsIcon, 
  BookOpen, 
  Download, 
  ScanLine,
  Printer,
  Sparkles,
  Check
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
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
  quotations = [],
  purchases = [],
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
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedTemplateTab, setSelectedTemplateTab] = useState('template_01');
  const [viewAllOptions, setViewAllOptions] = useState(false);

  const userProfile = useMemo(() => {
    return getStoredUserProfile(user?.uid);
  }, [user?.uid]);

  // Real Low Stock items calculation
  const lowStockItems = useMemo(() => {
    return inventoryItems.filter(item => (Number(item.stock) || 0) <= (Number(item.min_stock_level) || Number(item.low_stock_threshold) || 5));
  }, [inventoryItems]);

  const totalInvoicesCount = invoices.length;
  const totalQuotesCount = quotations.length;
  const totalPurchasesCount = purchases.length;

  // Real InvoCentric Templates with live demo details
  const realTemplates = [
    {
      id: 'template_01',
      name: 'Template 01 — Modern GST Tax Invoice',
      tag: 'A4 Format • Most Popular',
      category: 'GST Tax Invoice',
      description: 'Clean GST invoice with HSN/SAC table, CGST & SGST breakup, UPI QR code & bank details.',
      isThermal: false
    },
    {
      id: 'template_02',
      name: 'Template 02 — Corporate Bordered',
      tag: 'A4 Format • Formal B2B',
      category: 'B2B Corporate',
      description: 'Structured corporate dual-border format with buyer and consignee addresses.',
      isThermal: false
    },
    {
      id: 'template_03',
      name: 'Template 03 — Wholesale & Pharma Detailed',
      tag: 'A4 Format • Batch & Expiry',
      category: 'Pharma & FMCG',
      description: 'Specialized for distributors with Batch No, Expiry date, Pack size & HSN summary.',
      isThermal: false
    },
    {
      id: 'template_06',
      name: 'Template 06 — Nexus Enterprise Pro',
      tag: 'A4 Format • Premium Design',
      category: 'Enterprise Tech',
      description: 'Minimalist high-conversion dark-header design with digital verification seal.',
      isThermal: false
    },
    {
      id: 'template_04',
      name: 'Template 04 — POS Thermal 3-Inch (80mm)',
      tag: '80mm Roll • Thermal Receipt',
      category: 'Retail POS',
      description: 'Fast thermal roll billing for supermarts, restaurants and grocery counters.',
      isThermal: true
    },
    {
      id: 'template_05',
      name: 'Template 05 — POS Thermal 2-Inch (58mm)',
      tag: '58mm Roll • Bluetooth Handheld',
      category: 'Portable Thermal',
      description: 'Compact 58mm receipt layout optimized for mobile handheld Bluetooth printers.',
      isThermal: true
    }
  ];

  const handleSelectDefaultTemplate = (templateId: string) => {
    if (user?.uid) {
      saveStoredUserProfile(user.uid, {
        ...userProfile,
        invoice_template: templateId
      });
    }
    setSelectedTemplateTab(templateId);
  };

  return (
    <div className="space-y-4 pb-28 text-slate-800 font-sans">
      {/* ======================================================== */}
      {/* 1. TOP HEADER (Clean Store Title, No Icon/Logo/Badges)   */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3.5 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#0F645D]/10 text-[#0F645D] flex items-center justify-center font-black text-base shrink-0">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-slate-900 truncate">
              {storeName || 'My Store'}
            </h2>
            <p className="text-[11px] font-bold text-[#166534] tracking-wide">
              InvoCentic Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/invoices"
            className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition-all"
            title="Search Invoices"
          >
            <Search size={16} />
          </Link>
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="text-xs font-extrabold text-[#0F645D] bg-[#E6F3EE] hover:bg-emerald-100 px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            title="Explore InvoCentric Templates"
          >
            <Sparkles size={14} className="text-[#0F645D]" />
            <span>Templates</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TOP 3 PRIMARY DOCUMENT CARDS (Invoices, Quotes, POs)  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Card 1: Invoices */}
        <Link
          to="/invoices"
          className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center justify-between text-center shadow-xs hover:border-[#0F645D]/40 active:scale-95 transition-all group min-h-[110px]"
        >
          <div className="w-11 h-11 rounded-full bg-[#E6F3EE] text-[#0F645D] border border-emerald-100 flex items-center justify-center shadow-2xs mb-2 group-hover:scale-105 transition-transform">
            <FileText size={20} />
          </div>
          <div className="flex items-center gap-1 text-[12px] font-extrabold text-slate-900">
            <span>Invoices</span>
            <ArrowRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 mt-0.5">
            {totalInvoicesCount} Records
          </span>
        </Link>

        {/* Card 2: Quotations */}
        <Link
          to="/quotations"
          className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center justify-between text-center shadow-xs hover:border-[#0F645D]/40 active:scale-95 transition-all group min-h-[110px]"
        >
          <div className="w-11 h-11 rounded-full bg-teal-50 text-[#0F645D] border border-teal-100 flex items-center justify-center shadow-2xs mb-2 group-hover:scale-105 transition-transform">
            <FileSpreadsheet size={20} />
          </div>
          <div className="flex items-center gap-1 text-[12px] font-extrabold text-slate-900">
            <span>Quotations</span>
            <ArrowRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 mt-0.5">
            {totalQuotesCount} Estimates
          </span>
        </Link>

        {/* Card 3: Purchases */}
        <Link
          to="/purchases"
          className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center justify-between text-center shadow-xs hover:border-[#0F645D]/40 active:scale-95 transition-all group min-h-[110px]"
        >
          <div className="w-11 h-11 rounded-full bg-emerald-50 text-[#166534] border border-emerald-100 flex items-center justify-center shadow-2xs mb-2 group-hover:scale-105 transition-transform">
            <ShoppingBag size={20} />
          </div>
          <div className="flex items-center gap-1 text-[12px] font-extrabold text-slate-900">
            <span>Purchases</span>
            <ArrowRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 mt-0.5">
            {totalPurchasesCount} Orders
          </span>
        </Link>
      </div>

      {/* ======================================================== */}
      {/* 3. ORIGINAL APP KPI BENTO CARDS (Sales, Received, Due, Stock)*/}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Sales Revenue / Today's Sales */}
        <div className="bg-gradient-to-br from-[#E6F3EE] via-white to-white border border-[#0F645D]/20 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-extrabold text-[#0F645D]">
              {todaySales > 0 ? "Today's Sales" : "Sales Revenue"}
            </span>
            <div className="w-6 h-6 rounded-lg bg-[#0F645D]/10 text-[#0F645D] flex items-center justify-center">
              <TrendingUp size={13} />
            </div>
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {formatCurrency(todaySales > 0 ? todaySales : realTotalRevenue)}
            </p>
            <span className="inline-block mt-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
              Verified Revenue
            </span>
          </div>
        </div>

        {/* Card 2: Received Collections */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-extrabold text-slate-700">Received</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#166534] flex items-center justify-center">
              <CheckCircle2 size={13} />
            </div>
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {formatCurrency(realTotalRevenue)}
            </p>
            <span className="inline-block mt-1 text-[10px] font-semibold text-slate-500">
              Cash + UPI Synced
            </span>
          </div>
        </div>

        {/* Card 3: Customer Due */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-extrabold text-slate-700">Customer Due</span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <AlertCircle size={13} />
            </div>
          </div>
          <div>
            <p className={cn("text-lg font-black tracking-tight", realPendingAmount > 0 ? "text-rose-600" : "text-slate-900")}>
              {formatCurrency(realPendingAmount)}
            </p>
            <span className={cn(
              "inline-block mt-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded",
              realPendingAmount > 0 ? "text-rose-700 bg-rose-50" : "text-slate-500 bg-slate-100"
            )}>
              {realPendingAmount > 0 ? `${invoices.filter(i => i.status === 'sent' || i.status === 'overdue').length} Pending` : "All Clear"}
            </span>
          </div>
        </div>

        {/* Card 4: Low Stock Alert */}
        <Link 
          to="/items"
          className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-extrabold text-slate-700">Stock Alert</span>
            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Package size={13} />
            </div>
          </div>
          <div>
            <p className={cn("text-lg font-black tracking-tight", lowStockItems.length > 0 ? "text-slate-900" : "text-slate-900")}>
              {lowStockItems.length} Low
            </p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-extrabold text-[#0F645D] bg-[#E6F3EE] px-1.5 py-0.5 rounded">
              Check Inventory <ArrowRight size={10} />
            </span>
          </div>
        </Link>
      </div>

      {/* ======================================================== */}
      {/* 4. QUICK ACTIONS (REAL FEATURES ONLY)                    */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Quick Actions
          </h3>
          <span className="text-[10px] font-bold text-slate-400">
            Core Business Tools
          </span>
        </div>

        <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
          {/* Action 1: Quick POS Billing */}
          <Link to="/pos" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-[#0F645D] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              <ScanLine size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Quick POS</span>
          </Link>

          {/* Action 2: Create GST Invoice */}
          <Link to="/invoices/create" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-[#166534] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              <FileText size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">GST Invoice</span>
          </Link>

          {/* Action 3: Create Quotation */}
          <Link to="/quotations" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              <FileSpreadsheet size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Quotation</span>
          </Link>

          {/* Action 4: Inventory & Items */}
          <Link to="/items" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              <Package size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Products</span>
          </Link>

          {/* Action 5: Customer Khata */}
          <Link to="/customers" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-[#0F645D]/85 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              <Users size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Customers</span>
          </Link>

          {/* Action 6: Daily Cash Book */}
          <Link to="/dailybook" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-[#166534]/85 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              <Wallet size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Cash Book</span>
          </Link>

          {/* Action 7: Expenses */}
          <Link to="/expenses" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-slate-700 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              <Receipt size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Expenses</span>
          </Link>

          {/* Action 8: UPI Payment QR */}
          <Link to="/qr-generator" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              <QrCode size={24} />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">UPI QR Pay</span>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. MORE OPTIONS (REAL FEATURES ONLY)                     */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            More Options
          </h3>
          <button
            onClick={() => setViewAllOptions(!viewAllOptions)}
            className="text-[11px] font-bold text-[#0F645D] hover:underline cursor-pointer"
          >
            {viewAllOptions ? 'Show Less' : 'View All'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
          {/* Option 1: Barcode Generator */}
          <Link to="/barcode-generator" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
              <Barcode size={24} className="text-[#0F645D]" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Barcodes</span>
          </Link>

          {/* Option 2: Reports & Tax */}
          <Link to="/reports" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
              <BarChart3 size={24} className="text-[#166534]" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">GST Reports</span>
          </Link>

          {/* Option 3: Customer Statement */}
          <Link to="/customers" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
              <BookOpen size={24} className="text-teal-700" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Statements</span>
          </Link>

          {/* Option 4: Accounting Export */}
          <Link to="/accounting-export" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
            <div className="w-13 h-13 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
              <Download size={24} className="text-slate-800" />
            </div>
            <span className="text-[11px] font-bold text-slate-800 leading-tight">Tally Export</span>
          </Link>

          {/* Expandable Options */}
          {viewAllOptions && (
            <>
              {/* Option 5: Purchases */}
              <Link to="/purchases" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
                <div className="w-13 h-13 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
                  <ShoppingBag size={24} className="text-[#0F645D]" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Purchases</span>
              </Link>

              {/* Option 6: Payments */}
              <Link to="/payments" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
                <div className="w-13 h-13 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
                  <CreditCard size={24} className="text-[#166534]" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Payments</span>
              </Link>

              {/* Option 7: Recycle Bin */}
              <button onClick={onOpenRecycleBin} className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform cursor-pointer">
                <div className="w-13 h-13 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
                  <Trash2 size={24} className="text-rose-600" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Recycle Bin</span>
              </button>

              {/* Option 8: Settings */}
              <Link to="/settings" className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
                <div className="w-13 h-13 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
                  <SettingsIcon size={24} className="text-slate-800" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Settings</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6. FLOATING ACTION BUTTON (NO ICON, BRAND COLOR)         */}
      {/* ======================================================== */}
      <div className="fixed bottom-20 inset-x-0 flex items-center justify-center pointer-events-none z-30">
        <Link
          to="/invoices/create"
          className="pointer-events-auto bg-[#0F645D] hover:bg-[#0A4540] text-white font-extrabold text-sm px-8 py-3.5 rounded-full shadow-xl shadow-teal-900/25 active:scale-95 transition-all border border-teal-600/40 cursor-pointer"
        >
          Create Invoice
        </Link>
      </div>

      {/* ======================================================== */}
      {/* 🌟 TEMPLATES SHOWCASE MODAL (REAL INVOCENTRIC TEMPLATES)   */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showTemplatesModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    InvoCentric Invoice Templates
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Choose from your actual application's print formats
                  </p>
                </div>
                <button
                  onClick={() => setShowTemplatesModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Template Tabs Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {realTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplateTab(tpl.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer",
                      selectedTemplateTab === tpl.id 
                        ? "bg-[#0F645D] text-white shadow-xs" 
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {tpl.category}
                  </button>
                ))}
              </div>

              {/* Active Template Real Live Preview Card */}
              {(() => {
                const activeTpl = realTemplates.find(t => t.id === selectedTemplateTab) || realTemplates[0];
                return (
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{activeTpl.name}</h4>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 inline-block mt-0.5">
                            {activeTpl.tag}
                          </span>
                        </div>
                        {userProfile?.invoice_template === activeTpl.id && (
                          <span className="flex items-center gap-1 text-[11px] font-black text-[#0F645D] bg-[#E6F3EE] px-2 py-1 rounded-lg">
                            <Check size={13} /> Active Default
                          </span>
                        )}
                      </div>

                      {/* Authentic Real Template Preview UI */}
                      <div className="border border-slate-300 rounded-xl bg-white p-3.5 shadow-xs font-sans text-left space-y-2">
                        {/* Preview Header */}
                        <div className="border-b border-slate-200 pb-2 flex justify-between items-start">
                          <div>
                            <p className="text-xs font-black text-[#0F645D] uppercase tracking-wide">
                              {storeName || 'INVOCENTRIC STORE'}
                            </p>
                            <p className="text-[9px] text-slate-500 font-mono">
                              GSTIN: 27AABCU9603R1ZM • State: 27-Maharashtra
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black uppercase text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                              {activeTpl.isThermal ? 'CASH RECEIPT' : 'TAX INVOICE'}
                            </span>
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">INV-2026-0042</p>
                          </div>
                        </div>

                        {/* Customer Bill To */}
                        <div className="text-[9px] text-slate-600 bg-slate-50/70 p-2 rounded-lg flex justify-between">
                          <div>
                            <span className="font-bold text-slate-800">Bill To: </span>
                            <span>Rajesh Sharma (Sharma Electronics)</span>
                          </div>
                          <div className="font-mono text-slate-500">
                            Date: {new Date().toLocaleDateString('en-IN')}
                          </div>
                        </div>

                        {/* Items Table Mock matching template */}
                        <div className="overflow-x-auto text-[9px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/50">
                                <th className="py-1 px-1">Item</th>
                                {!activeTpl.isThermal && <th className="py-1 px-1">HSN</th>}
                                <th className="py-1 px-1 text-center">Qty</th>
                                <th className="py-1 px-1 text-right">Rate</th>
                                <th className="py-1 px-1 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              <tr>
                                <td className="py-1 px-1 font-semibold">Wireless Barcode Scanner</td>
                                {!activeTpl.isThermal && <td className="py-1 px-1 font-mono text-slate-500">8471</td>}
                                <td className="py-1 px-1 text-center">1</td>
                                <td className="py-1 px-1 text-right">₹1,800.00</td>
                                <td className="py-1 px-1 text-right font-bold">₹1,800.00</td>
                              </tr>
                              <tr>
                                <td className="py-1 px-1 font-semibold">80mm Thermal Receipt Rolls (10pk)</td>
                                {!activeTpl.isThermal && <td className="py-1 px-1 font-mono text-slate-500">4820</td>}
                                <td className="py-1 px-1 text-center">2</td>
                                <td className="py-1 px-1 text-right">₹350.00</td>
                                <td className="py-1 px-1 text-right font-bold">₹700.00</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Calculation Total Box */}
                        <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[10px]">
                          <div className="text-[8px] text-slate-400">
                            {!activeTpl.isThermal ? "Includes CGST 9% (₹225) + SGST 9% (₹225)" : "Thank you for visiting!"}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-600 mr-2">Grand Total:</span>
                            <span className="font-black text-sm text-[#0F645D]">₹2,500.00</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {activeTpl.description}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectDefaultTemplate(activeTpl.id)}
                        className="flex-1 py-3 rounded-xl bg-[#0F645D] hover:bg-[#0A4540] text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                      >
                        Set as Default Template
                      </button>
                      <button
                        onClick={() => {
                          setShowTemplatesModal(false);
                          navigate('/invoices/create');
                        }}
                        className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition-all cursor-pointer"
                      >
                        Try with New Invoice
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
