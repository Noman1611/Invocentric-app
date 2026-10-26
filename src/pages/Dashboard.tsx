import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Plus,
  Users,
  Receipt,
  Wallet,
  ArrowUpRight,
  Package,
  AlertTriangle,
  Loader2,
  Download,
  Calendar,
  MoreVertical,
  MoreHorizontal,
  ChevronDown,
  ArrowRight,
  Store,
  Briefcase,
  ScanLine,
  Trash2,
  RotateCcw,
  Search,
  Bell,
  Sparkles,
  MessageCircle,
  Share2,
  Zap,
  ShoppingBag,
  FileCheck,
  RefreshCw
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { useInvoices, useCustomers, useItems, useRecycleBin, useNotifications } from '../hooks/useData';
import { dbService } from '../services/dbService';
import { syncAllUserDataFromFirestore } from '../utils/firestoreRestFallback';
import RecycleBinModal from '../components/RecycleBinModal';
import { format, subDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { parseDateSafe, getRelativeTimeString } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { AppUpdateButton } from '../components/AppUpdateButton';
import { Link, useNavigate } from 'react-router-dom';
import { useAutoReminders } from '../hooks/useAutoReminders';
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import { exportInvoicesAsMultiSheet } from '../services/excelService';
import { IS_TEST_BUILD } from '../config/appChannel';
import { getStoredUserProfile } from '../utils/settingsStorage';
import { ScrollableTabBar } from '../components/ScrollableTabBar';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isOfflineMode, appMode, planTier, isTrialActive, isOwner } = useAuth();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { customers, loading: customersLoading } = useCustomers();
  const { items: inventoryItems, loading: itemsLoading } = useItems();
  const { recycleBinItems } = useRecycleBin();
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  useAutoReminders();

  const { notifications } = useNotifications();
  const unreadNotifCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const [period, setPeriod] = useState<'Today' | 'Week' | 'Month' | 'Year'>('Month');
  const [timeFilter, setTimeFilter] = useState('This Year');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualSync = async () => {
    if (!user?.uid || isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback('Syncing...');
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await dbService.syncOfflineData(user.uid);
        await syncAllUserDataFromFirestore(user.uid, user.email);
      }
      setSyncFeedback('Cloud Synced!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (e) {
      console.warn('Manual sync note:', e);
      setSyncFeedback('Local cache ready');
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else if (hour >= 17 && hour < 22) {
      return 'Good evening';
    } else {
      return 'Good night';
    }
  }, []);

  const handleExportToday = () => {
    const todayInvoices = invoices.filter(inv => {
      const invDate = inv.created_at ? parseDateSafe(inv.created_at) : new Date();
      return isSameDay(invDate, new Date());
    });

    if (todayInvoices.length === 0) {
      alert('No invoices found for today to export.');
      return;
    }

    exportInvoicesAsMultiSheet(todayInvoices, `Daily_Report_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const loading = invoicesLoading || customersLoading || itemsLoading;

  // Helper to extract numeric amount safely from invoice
  const getInvoiceAmount = (inv: any) => Number(inv?.total ?? inv?.amount ?? inv?.grand_total ?? 0);

  // Real data calculations
  const realTotalRevenue = useMemo(() => invoices
    .filter(inv => inv.status === 'paid')
    .reduce((acc, inv) => acc + getInvoiceAmount(inv), 0), [invoices]);

  const realPendingAmount = useMemo(() => invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((acc, inv) => acc + getInvoiceAmount(inv), 0), [invoices]);

  const overdueInvoicesCount = useMemo(() => invoices.filter(inv => inv.status === 'overdue').length, [invoices]);
  const lowStockItems = useMemo(() => inventoryItems.filter(item => (Number(item.stock) || 0) <= (Number(item.min_stock_level) || Number(item.low_stock_threshold) || 5)), [inventoryItems]);

  // Dynamic Sales by selected period
  const periodSales = useMemo(() => {
    const now = new Date();
    if (period === 'Today') {
      return invoices
        .filter(inv => inv.status === 'paid' && inv.created_at && isSameDay(parseDateSafe(inv.created_at), now))
        .reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
    } else if (period === 'Week') {
      const weekStart = subDays(now, 7);
      return invoices
        .filter(inv => inv.status === 'paid' && inv.created_at && parseDateSafe(inv.created_at) >= weekStart)
        .reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
    } else if (period === 'Month') {
      const monthStart = startOfMonth(now);
      return invoices
        .filter(inv => inv.status === 'paid' && inv.created_at && parseDateSafe(inv.created_at) >= monthStart)
        .reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
    } else {
      return realTotalRevenue;
    }
  }, [invoices, period, realTotalRevenue]);

  // Dynamic Month-over-Month calculation
  const trends = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subDays(currentMonthStart, 15));
    const prevMonthEnd = endOfMonth(prevMonthStart);

    const currentMonthInvoices = invoices.filter(inv => {
      const d = parseDateSafe(inv.created_at);
      return d >= currentMonthStart;
    });

    const prevMonthInvoices = invoices.filter(inv => {
      const d = parseDateSafe(inv.created_at);
      return d >= prevMonthStart && d <= prevMonthEnd;
    });

    const curRev = currentMonthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + getInvoiceAmount(i), 0);
    const prevRev = prevMonthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + getInvoiceAmount(i), 0);

    const revGrowth = prevRev > 0 
      ? Math.round(((curRev - prevRev) / prevRev) * 100)
      : (curRev > 0 ? 100 : 0);

    const invGrowth = prevMonthInvoices.length > 0
      ? Math.round(((currentMonthInvoices.length - prevMonthInvoices.length) / prevMonthInvoices.length) * 100)
      : (currentMonthInvoices.length > 0 ? 100 : 0);

    return {
      revGrowthText: revGrowth === 0 && curRev === 0 ? '0% vs last month' : (revGrowth >= 0 ? `+${revGrowth}% vs last month` : `${revGrowth}% vs last month`),
      revIsPositive: revGrowth >= 0,
      invGrowthText: invGrowth === 0 && currentMonthInvoices.length === 0 ? '0% vs last month' : (invGrowth >= 0 ? `+${invGrowth}% vs last month` : `${invGrowth}% vs last month`),
      invIsPositive: invGrowth >= 0
    };
  }, [invoices]);

  // Stats Data
  const statsData = useMemo(() => {
    return [
      {
        name: 'Direct Revenue',
        value: realTotalRevenue,
        change: trends.revGrowthText,
        isPositive: trends.revIsPositive,
        color: 'text-[#163C2C]',
        bg: 'bg-[#D7F4D4]',
        icon: '₹',
      },
      {
        name: 'Pending Payments',
        value: realPendingAmount,
        change: realPendingAmount > 0 ? 'Awaiting settlement' : 'All clear',
        isPositive: realPendingAmount === 0,
        color: 'text-[#B7892E]',
        bg: 'bg-[#FCF0CC]',
        iconClass: Wallet,
      },
      {
        name: 'Active Invoices',
        value: invoices.length,
        change: trends.invGrowthText,
        isPositive: trends.invIsPositive,
        color: 'text-[#118062]',
        bg: 'bg-[#DDF3DF]',
        iconClass: FileText,
      },
      {
        name: appMode === 'freelancer' ? 'Total Clients' : 'Total Customers',
        value: customers.length,
        change: customers.length > 0 ? `${customers.length} registered` : 'No customers yet',
        isPositive: true,
        color: 'text-[#163C2C]',
        bg: 'bg-[#EFF5E8]',
        iconClass: Users,
      }
    ];
  }, [invoices.length, customers.length, realTotalRevenue, realPendingAmount, appMode, trends]);

  // Combined chart data based on real sales
  const chartData = useMemo(() => {
    return [...Array(6)].map((_, i) => {
      const date = subDays(new Date(), i * 30);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const monthInvoices = invoices.filter(inv => {
        if (!inv.created_at) return false;
        const d = parseDateSafe(inv.created_at);
        return d >= monthStart && d <= monthEnd;
      });
      return {
        name: format(date, 'MMM'),
        revenue: monthInvoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + getInvoiceAmount(inv), 0),
      };
    }).reverse();
  }, [invoices]);

  // Metrics definition
  const metrics = statsData;

  // High fidelity Real Recent Invoices
  const recentInvoices = useMemo(() => {
    return invoices.slice(0, 5).map(inv => ({
      id: inv.id,
      invoiceNum: inv.invoice_number || `INV-${inv.id.slice(0,3).toUpperCase()}`,
      customerName: inv.customer_name || inv.customer?.name || 'Customer',
      customerPhone: inv.customer?.phone || '',
      date: inv.created_at ? format(parseDateSafe(inv.created_at), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy'),
      amount: getInvoiceAmount(inv),
      status: inv.status || 'sent',
      currency: inv.currency || 'INR',
      rawInvoice: inv
    }));
  }, [invoices]);
  const displayedInvoices = recentInvoices;

  const userProfile = useMemo(() => {
    return getStoredUserProfile(user?.uid);
  }, [user?.uid]);

  const storeName = userProfile?.business_name || user?.displayName || 'InvoCentric Store';

  const handleWhatsAppShare = (inv: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = (inv.customerPhone || inv.rawInvoice?.customer?.phone || '').replace(/\D/g, '');
    const phoneParam = phone ? (phone.length === 10 ? `91${phone}` : phone) : '';
    const text = encodeURIComponent(
      `Hello ${inv.customerName || 'Customer'},\nHere is your invoice ${inv.invoiceNum} for ${formatCurrency(inv.amount || 0)} from ${storeName}.\nStatus: ${(inv.status || 'PAID').toUpperCase()}\nThank you for choosing us!`
    );
    const url = phoneParam ? `https://wa.me/${phoneParam}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* ======================================================== */}
      {/* 🌟 TOP GREETING & BUSINESS CHIPS                         */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[31px] font-semibold tracking-[-1.5px] leading-[1.2] text-[#102723]">
            {greeting},<br />
            <b className="font-extrabold">{user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Partner'}.</b> ✦
          </h1>
          <p className="text-xs text-[#7B8781] mt-1 font-medium">A little overview. A lot of possibilities.</p>
        </div>

        {/* Business & Sync Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Business Switcher Chip */}
          <button
            onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-[#E9EFE6] text-[#102723] hover:bg-[#D7F4D4] transition-all cursor-pointer shadow-xs active:scale-95"
            title="Business Settings"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#139D77] inline-block animate-pulse"></span>
            <span className="truncate max-w-[150px]">{storeName}</span>
            <ArrowRight size={12} className="text-[#7B8781]" />
          </button>

          {/* Sync Mode Chip */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-[#E9EFE6] text-[#102723] hover:bg-[#D7F4D4] transition-all cursor-pointer shadow-xs active:scale-95"
            title="Tap to sync database with Cloud"
          >
            <RefreshCw size={11} className={cn("text-[#163C2C]", isSyncing && "animate-spin")} />
            <span>{syncFeedback || (isSyncing ? "Syncing..." : isOfflineMode ? "Local PC Mode" : "Cloud Mode")}</span>
          </button>

          {/* Notifications Trigger Button (Toggles Unified Floating Notifications) */}
          <button
            type="button"
            data-notification-trigger="true"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('open_notifications'));
            }}
            className="w-8 h-8 rounded-full border border-[#E5EBE0] bg-white text-[#7B8781] hover:text-[#102723] hover:bg-[#F6F8F3] flex items-center justify-center transition-all relative cursor-pointer active:scale-95 shadow-2xs"
            title="Notifications & Alerts"
          >
            <Bell size={15} />
            {(unreadNotifCount > 0 || overdueInvoicesCount > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#BE3349] rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>

          {/* In-App Update Trigger */}
          <AppUpdateButton />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🌿 HERO REVENUE CARD (Mint #D7F4D4 with Period Tabs)      */}
      {/* ======================================================== */}
      <section className="bg-[#D7F4D4] rounded-[30px] p-5 sm:p-6 relative overflow-hidden shadow-xs">
        {/* Period Tabs Capsule */}
        <div className="flex bg-[#C6E9C1] p-1 rounded-full gap-1 mb-5 max-w-fit">
          {(['Today', 'Week', 'Month', 'Year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3.5 sm:px-4 py-1.5 rounded-full text-xs transition-all cursor-pointer",
                period === p 
                  ? "bg-white text-[#102723] font-extrabold shadow-xs" 
                  : "text-[#163C2C] font-semibold hover:bg-white/40"
              )}
            >
              {p === 'Week' ? 'This Week' : p === 'Month' ? 'This Month' : p === 'Year' ? 'This Year' : 'Today'}
            </button>
          ))}
        </div>

        <div className="text-xs font-semibold text-[#163C2C] tracking-wide">Your sales revenue</div>
        <div className="text-3xl sm:text-[40px] font-extrabold tracking-[-1.5px] text-[#102723] my-2 font-mono tabular-nums">
          {formatCurrency(periodSales)}
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-[#BDE7B6] text-[#163C2C] px-2.5 py-1 rounded-full">
          <span>↗ {trends.revGrowthText}</span>
        </div>

        {/* Decorative Art Badge */}
        <div className="hidden sm:flex absolute right-5 bottom-5 w-20 h-20 rounded-[22px] bg-[#C7EABA] border border-[#9ACB94] rotate-[-12deg] items-center justify-center text-[#0F645D] shadow-xs pointer-events-none">
          <TrendingUp size={36} strokeWidth={2} />
        </div>
      </section>

      {/* ======================================================== */}
      {/* 📊 MINI STATS (2-Column: White & Dark Cards)             */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Metric 1: Payments Received (White Card) */}
        <button
          onClick={() => navigate('/payments')}
          className="bg-white border border-[#E9EEE4] hover:border-[#CCD4C8] rounded-[25px] p-5 text-left relative transition-all active:scale-[0.99] cursor-pointer shadow-xs"
        >
          <Receipt size={18} className="absolute right-5 top-5 text-[#163C2C]" />
          <div className="text-xs text-[#7B8781] font-medium">Payments received</div>
          <div className="text-2xl sm:text-[25px] font-extrabold tracking-tight text-[#102723] my-2 font-mono tabular-nums">
            {formatCurrency(realTotalRevenue)}
          </div>
          <div className="text-[10px] text-[#7B8781] font-semibold">Cash + UPI collections</div>
        </button>

        {/* Metric 2: Customer Dues (Dark Card #073E36) */}
        <button
          onClick={() => navigate('/customers')}
          className="bg-[#073E36] text-white hover:bg-[#10251F] rounded-[25px] p-5 text-left relative transition-all active:scale-[0.99] cursor-pointer shadow-xs"
        >
          <Users size={18} className="absolute right-5 top-5 text-[#D7F4D4]" />
          <div className="text-xs text-[#B1C9B9] font-medium">Customer dues</div>
          <div className="text-2xl sm:text-[25px] font-extrabold tracking-tight text-white my-2 font-mono tabular-nums">
            {formatCurrency(realPendingAmount)}
          </div>
          <div className="text-[10px] text-[#CDE9C3] font-semibold flex items-center gap-1">
            <span>{overdueInvoicesCount > 0 ? `${overdueInvoicesCount} overdue bills` : 'All accounts clear'} ↗</span>
          </div>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 🚀 QUICK ACTIONS (Make your next move)                   */}
      {/* ======================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[15px] font-bold text-[#102723] tracking-tight">Make your next move</h2>
          <button 
            onClick={() => navigate('/invoices')} 
            className="text-[11px] font-extrabold text-[#0F645D] hover:underline"
          >
            All tools ↗
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {/* Action 1: Create Invoice */}
          <button
            onClick={() => navigate('/invoices/create')}
            className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
          >
            <div className="w-14 h-14 rounded-full bg-[#D7F4D4] border border-[#C6E9C1] flex items-center justify-center text-[#163C2C] mb-2 group-hover:scale-105 transition-transform shadow-xs">
              <FileText size={22} />
            </div>
            <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Invoice</span>
          </button>

          {/* Action 2: Quotation */}
          <button
            onClick={() => navigate('/quotations')}
            className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
          >
            <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
              <FileCheck size={22} />
            </div>
            <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Quotation</span>
          </button>

          {/* Action 3: Purchase Bill */}
          <button
            onClick={() => navigate('/purchases')}
            className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
          >
            <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
              <ShoppingBag size={22} />
            </div>
            <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Purchase</span>
          </button>

          {/* Action 4: Products */}
          <button
            onClick={() => navigate('/items')}
            className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
          >
            <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
              <Package size={22} />
            </div>
            <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Products</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ⚡ QUICK POS SALE PROMINENT BANNER                       */}
      {/* ======================================================== */}
      <button
        onClick={() => navigate('/pos')}
        className="w-full rounded-[22px] bg-[#073E36] hover:bg-[#10251F] text-white p-4 sm:p-5 flex items-center gap-3.5 text-left transition-all active:scale-[0.99] cursor-pointer shadow-md group"
      >
        <div className="w-10 h-10 rounded-full bg-white/10 text-[#D7F4D4] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
          <ScanLine size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <strong className="text-sm font-bold block text-white">Quick POS sale</strong>
          <small className="text-[11px] text-[#B1C9B9] block mt-0.5">Scan a product. Make a sale.</small>
        </div>
        <ArrowRight size={18} className="text-[#D7F4D4] shrink-0 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* ======================================================== */}
      {/* 📈 BUSINESS IN MOTION (Interactive Sales Overview Chart) */}
      {/* ======================================================== */}
      <div className="bg-white border border-[#E9EEE4] rounded-[27px] p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13px] font-bold text-[#102723]">Sales overview</div>
            <div className="text-2xl font-extrabold tracking-tight text-[#102723] my-1 font-mono tabular-nums">
              {formatCurrency(realTotalRevenue)}
            </div>
            <div className="text-xs text-[#7B8781]">Monthly trend derived from active billing data.</div>
          </div>
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none bg-[#F6F8F3] hover:bg-[#E9EFE6] border border-[#E5EBE0] rounded-full pl-3 pr-7 py-1.5 text-xs font-bold text-[#102723] cursor-pointer focus:outline-none"
            >
              <option value="This Year">Last 6 months</option>
              <option value="This Month">This month</option>
              <option value="All Time">All time</option>
            </select>
            <ChevronDown size={12} className="text-[#7B8781] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-44 sm:h-56 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D3EFCD" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#D3EFCD" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#F0F4EC" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#8A948C" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#8A948C" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
              <Tooltip 
                formatter={(val: any) => [formatCurrency(Number(val)), 'Sales']}
                contentStyle={{ backgroundColor: '#073E36', borderRadius: '14px', color: '#fff', fontSize: '12px', border: 'none' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#073E36" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ⏱ RECENT ACTIVITY & INVOICES LIST                        */}
      {/* ======================================================== */}
      <div className="bg-white border border-[#E9EEE4] rounded-[27px] p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[#102723] tracking-tight">Recent activity</h2>
          <button 
            onClick={() => navigate('/invoices')} 
            className="text-[11px] font-extrabold text-[#0F645D] hover:underline"
          >
            View all ↗
          </button>
        </div>

        <div className="divide-y divide-[#EDF1E8]">
          {displayedInvoices.length === 0 ? (
            <div className="text-center py-8 text-[#7B8781]">
              <FileText className="mx-auto text-[#CCD4C8] mb-2" size={28} />
              <p className="text-xs font-semibold text-[#102723]">No transactions yet</p>
              <button 
                onClick={() => navigate('/invoices/create')}
                className="text-xs font-bold text-[#0F645D] hover:underline mt-1"
              >
                Create your first invoice
              </button>
            </div>
          ) : (
            displayedInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className="py-3.5 flex items-center gap-3 text-left w-full cursor-pointer hover:bg-[#F6F8F3] px-2 rounded-xl transition-colors"
              >
                {/* Initial Avatar */}
                <div className="w-10 h-10 flex-shrink-0 rounded-2xl bg-[#EFF5E8] flex items-center justify-center text-[#1C563C] text-xs font-extrabold">
                  {inv.customerName.slice(0, 2).toUpperCase()}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <b className="text-xs font-bold text-[#102723] truncate block">{inv.customerName}</b>
                  <small className="text-[10px] text-[#7B8781] block mt-0.5">{inv.invoiceNum} · {inv.date}</small>
                </div>

                {/* WhatsApp Share Action */}
                <button
                  onClick={(e) => handleWhatsAppShare(inv, e)}
                  title="Share invoice summary on WhatsApp"
                  className="p-1.5 rounded-lg bg-[#EFF5E8] text-[#163C2C] hover:bg-[#D7F4D4] transition-colors"
                >
                  <MessageCircle size={14} />
                </button>

                {/* Right Amount & Status */}
                <div className="text-right flex-shrink-0">
                  <b className="text-xs font-extrabold text-[#102723] block font-mono tabular-nums">
                    {formatCurrency(inv.amount, inv.currency)}
                  </b>
                  <span className={cn(
                    "inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full mt-1",
                    inv.status === 'paid' 
                      ? "bg-[#DDF3DF] text-[#118062]" 
                      : inv.status === 'overdue' 
                      ? "bg-[#FBE4E8] text-[#BE3349]" 
                      : "bg-[#FCF0CC] text-[#B7892E]"
                  )}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📦 SHELVES READY STOCK ALERT CARD                        */}
      {/* ======================================================== */}
      <button
        onClick={() => navigate('/items?tab=lowstock')}
        className="w-full rounded-[23px] bg-[#ECF0E7] hover:bg-[#E2E9DC] p-4 sm:p-5 flex items-center gap-3.5 text-left transition-all active:scale-[0.99] cursor-pointer shadow-xs group"
      >
        <Package size={22} className="text-[#163C2C] shrink-0" />
        <div className="min-w-0 flex-1">
          <strong className="text-xs font-bold block text-[#102723]">Keep your shelves ready.</strong>
          <small className="text-[10px] text-[#7B8781] block mt-0.5">
            {lowStockItems.length} low-stock products · View inventory
          </small>
        </div>
        <ArrowRight size={16} className="text-[#163C2C] shrink-0 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* ======================================================== */}
      {/* 🗑 RECYCLE BIN DATA PROTECTION CARD                       */}
      {/* ======================================================== */}
      <div className="bg-white border border-[#E9EEE4] rounded-[25px] p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 size={16} className="text-[#163C2C]" />
          <strong className="text-xs font-bold text-[#102723]">A safety net for your data</strong>
          <span className="text-[10px] font-extrabold bg-[#D7F4D4] text-[#163C2C] px-2 py-0.5 rounded-full ml-auto">
            {recycleBinItems.length} items
          </span>
        </div>
        <p className="text-[11px] text-[#7B8781] leading-relaxed my-2">
          Deleted something by mistake? Invoices, clients, and inventory products stay safely stored for 30 days before permanent cleanup.
        </p>
        <button
          onClick={() => setIsRecycleBinOpen(true)}
          className="text-[11px] font-extrabold text-[#0F645D] hover:underline flex items-center gap-1.5 mt-2 cursor-pointer"
        >
          <span>Open recycle bin</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Recycle Bin Modal */}
      <RecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
      />
    </div>
  );
}
