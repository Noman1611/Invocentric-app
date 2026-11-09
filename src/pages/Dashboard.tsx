import React, { useMemo, useState } from 'react';
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
  ChevronDown, 
  ArrowRight, 
  Store, 
  Briefcase, 
  ScanLine, 
  Trash2, 
  RefreshCw, 
  Search, 
  Bell, 
  Sparkles, 
  MessageCircle, 
  Share2, 
  Zap, 
  ShoppingBag, 
  FileCheck, 
  CreditCard,
  Eye,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  BookOpen,
  BarChart3,
  Barcode,
  Truck,
  Settings
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { useInvoices, useCustomers, useItems, useRecycleBin, useNotifications } from '../hooks/useData';
import { dbService } from '../services/dbService';
import { syncAllUserDataFromFirestore } from '../utils/firestoreRestFallback';
import RecycleBinModal from '../components/RecycleBinModal';
import { format, subDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';
import { AppUpdateButton } from '../components/AppUpdateButton';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAutoReminders } from '../hooks/useAutoReminders';
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import { exportInvoicesAsMultiSheet } from '../services/excelService';
import { getStoredUserProfile } from '../utils/settingsStorage';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isOfflineMode, appMode, isTrialActive } = useAuth();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { customers, loading: customersLoading } = useCustomers();
  const { items: inventoryItems, loading: itemsLoading } = useItems();
  const { recycleBinItems } = useRecycleBin();
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isAllToolsOpen, setIsAllToolsOpen] = useState(false);
  useAutoReminders();

  const { notifications } = useNotifications();
  const unreadNotifCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const [period, setPeriod] = useState<'Today' | 'Week' | 'Month' | 'Year'>('Month');
  const [timeFilter, setTimeFilter] = useState<'6months' | 'month' | 'year'>('6months');
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
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Good night';
  }, []);

  const handleExportToday = () => {
    const todayInvoices = invoices.filter(inv => {
      const invDate = inv.created_at ? parseDateSafe(inv.created_at) : new Date();
      return isSameDay(invDate, new Date());
    });

    if (todayInvoices.length === 0) {
      alert('No invoices found for today to export. Exporting recent invoices instead.');
      if (invoices.length > 0) {
        exportInvoicesAsMultiSheet(invoices.slice(0, 50), `Invoice_Report_${format(new Date(), 'yyyy-MM-dd')}`);
      }
      return;
    }

    exportInvoicesAsMultiSheet(todayInvoices, `Daily_Report_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const loading = invoicesLoading || customersLoading || itemsLoading;

  // Helper to extract numeric amount safely from invoice
  const getInvoiceAmount = (inv: any) => Number(inv?.total ?? inv?.amount ?? inv?.grand_total ?? 0);

  // Real data calculations & business metrics
  const realTotalRevenue = useMemo(() => invoices
    .filter(inv => inv.status === 'paid')
    .reduce((acc, inv) => acc + getInvoiceAmount(inv), 0), [invoices]);

  const realPendingAmount = useMemo(() => invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((acc, inv) => acc + getInvoiceAmount(inv), 0), [invoices]);

  const overdueInvoicesCount = useMemo(() => invoices.filter(inv => inv.status === 'overdue').length, [invoices]);
  const lowStockItems = useMemo(() => inventoryItems.filter(item => (Number(item.stock) || 0) <= (Number(item.min_stock_level) || Number(item.low_stock_threshold) || 5)), [inventoryItems]);

  const metrics = useMemo(() => ({
    totalRevenue: realTotalRevenue,
    pendingAmount: realPendingAmount,
    overdueCount: overdueInvoicesCount,
    lowStockCount: lowStockItems.length
  }), [realTotalRevenue, realPendingAmount, overdueInvoicesCount, lowStockItems.length]);

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

    return {
      revGrowthText: revGrowth === 0 && curRev === 0 ? '0% vs last month' : (revGrowth >= 0 ? `+${revGrowth}% vs last mo.` : `${revGrowth}% vs last mo.`),
      revIsPositive: revGrowth >= 0
    };
  }, [invoices]);

  // Dynamic chart data calculation strictly honoring timeFilter
  const chartData = useMemo(() => {
    const now = new Date();
    if (timeFilter === 'month') {
      // Return 4 weeks of current month
      return [1, 2, 3, 4].map(wk => {
        const weekStart = subDays(now, (4 - wk) * 7);
        const weekEnd = subDays(now, (4 - wk - 1) * 7);
        const rev = invoices.filter(inv => {
          if (!inv.created_at || inv.status !== 'paid') return false;
          const d = parseDateSafe(inv.created_at);
          return d >= weekStart && d <= weekEnd;
        }).reduce((acc, inv) => acc + getInvoiceAmount(inv), 0);
        return { name: `Week ${wk}`, revenue: rev };
      });
    } else if (timeFilter === 'year') {
      // Months Jan to current
      const currMonth = now.getMonth();
      return [...Array(currMonth + 1)].map((_, i) => {
        const d = new Date(now.getFullYear(), i, 1);
        const mStart = startOfMonth(d);
        const mEnd = endOfMonth(d);
        const rev = invoices.filter(inv => {
          if (!inv.created_at || inv.status !== 'paid') return false;
          const dInv = parseDateSafe(inv.created_at);
          return dInv >= mStart && dInv <= mEnd;
        }).reduce((acc, inv) => acc + getInvoiceAmount(inv), 0);
        return { name: format(d, 'MMM'), revenue: rev };
      });
    } else {
      // Default: Last 6 months
      return [...Array(6)].map((_, i) => {
        const date = subDays(now, i * 30);
        const mStart = startOfMonth(date);
        const mEnd = endOfMonth(date);
        const rev = invoices.filter(inv => {
          if (!inv.created_at || inv.status !== 'paid') return false;
          const d = parseDateSafe(inv.created_at);
          return d >= mStart && d <= mEnd;
        }).reduce((acc, inv) => acc + getInvoiceAmount(inv), 0);
        return { name: format(date, 'MMM'), revenue: rev };
      }).reverse();
    }
  }, [invoices, timeFilter]);

  // High fidelity Real Recent Invoices (Table view)
  const recentInvoices = useMemo(() => {
    return invoices.slice(0, 6).map(inv => ({
      id: inv.id,
      invoiceNum: inv.invoice_number || `INV-${inv.id.slice(0, 4).toUpperCase()}`,
      customerName: inv.customer_name || inv.customer?.name || 'Walk-in Customer',
      customerPhone: inv.customer?.phone || '',
      date: inv.created_at ? format(parseDateSafe(inv.created_at), 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy'),
      amount: getInvoiceAmount(inv),
      status: inv.status || 'sent',
      currency: inv.currency || 'INR',
      rawInvoice: inv
    }));
  }, [invoices]);

  // Top Customer Outstanding Dues (Debtors)
  const topDebtorCustomers = useMemo(() => {
    return customers.map(c => {
      const custInvoices = invoices.filter(inv => {
        if (!inv) return false;
        if (inv.customer_id && c.id && String(inv.customer_id) === String(c.id)) return true;
        if (inv.customer_name && c.name && inv.customer_name.trim().toLowerCase() === c.name.trim().toLowerCase()) return true;
        return false;
      });
      const pendingTotal = custInvoices
        .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        pendingTotal,
        overdueCount: custInvoices.filter(inv => inv.status === 'overdue').length
      };
    })
    .filter(item => item.pendingTotal > 0)
    .sort((a, b) => b.pendingTotal - a.pendingTotal)
    .slice(0, 4);
  }, [customers, invoices]);

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

  const handleCustomerDuesReminder = (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = (c.phone || '').replace(/\D/g, '');
    const phoneParam = phone ? (phone.length === 10 ? `91${phone}` : phone) : '';
    const text = encodeURIComponent(
      `Dear ${c.name},\nThis is a gentle payment reminder from ${storeName} regarding your outstanding balance of ${formatCurrency(c.pendingTotal)}.\nPlease clear your pending dues at your earliest convenience. Thank you!`
    );
    const url = phoneParam ? `https://wa.me/${phoneParam}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleCreatePoForLowStock = () => {
    if (lowStockItems.length === 0) {
      navigate('/items?tab=lowstock');
      return;
    }
    const poPayload = lowStockItems.slice(0, 10).map(i => ({
      itemId: i.id,
      name: i.name,
      currentStock: i.stock,
      unit: i.unit || 'Pcs',
      threshold: i.min_stock_level || i.low_stock_threshold || 5,
      quantity: i.reorder_quantity || Math.max(10, ((i.min_stock_level || i.low_stock_threshold || 5) * 2) - (Number(i.stock) || 0)),
      price: i.last_purchase_price || (i as any).costPrice || (i as any).cost_price || i.price || 0,
      supplierName: i.supplier_name || ''
    }));
    navigate('/purchases', { state: { createPoFromLowStock: true, poItems: poPayload } });
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 📱 SMARTPHONE ANDROID APP VIEW (md:hidden)                */}
      {/* ======================================================== */}
      <div className="md:hidden space-y-6 pb-20 font-sans">
        {/* 🌟 TOP GREETING & BUSINESS CHIPS */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-1.5px] leading-[1.2] text-[#102723]">
              {greeting},<br />
              <b className="font-extrabold">{user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Noman'}.</b> ✦
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

            {/* Notifications Trigger Button */}
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

        {/* 🌿 HERO REVENUE CARD (Mint #D7F4D4 with Period Tabs) */}
        <section className="bg-[#D7F4D4] rounded-[30px] p-5 relative overflow-hidden shadow-xs">
          {/* Period Tabs Capsule */}
          <div className="flex bg-[#C6E9C1] p-1 rounded-full gap-1 mb-5 max-w-fit">
            {(['Today', 'Week', 'Month', 'Year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs transition-all cursor-pointer",
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
          <div className="text-3xl font-extrabold tracking-[-1.5px] text-[#102723] my-2 font-mono tabular-nums">
            {formatCurrency(periodSales)}
          </div>
          <div className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-[#BDE7B6] text-[#163C2C] px-2.5 py-1 rounded-full">
            <span>↗ {trends.revGrowthText}</span>
          </div>
        </section>

        {/* 📊 MINI STATS (2-Column: White & Dark Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Metric 1: Payments Received (White Card) */}
          <button
            onClick={() => navigate('/payments')}
            className="bg-white border border-[#E9EEE4] hover:border-[#CCD4C8] rounded-[25px] p-5 text-left relative transition-all active:scale-[0.99] cursor-pointer shadow-xs"
          >
            <Receipt size={18} className="absolute right-5 top-5 text-[#163C2C]" />
            <div className="text-xs text-[#7B8781] font-medium">Payments received</div>
            <div className="text-2xl font-extrabold tracking-tight text-[#102723] my-2 font-mono tabular-nums">
              {formatCurrency(realTotalRevenue)}
            </div>
            <div className="text-[10px] text-[#7B8781] font-semibold">Cash + UPI collections</div>
          </button>

          {/* Metric 2: Customer Dues (Dark Card #073E36) */}
          <button
            onClick={() => navigate('/customers?filter=dues')}
            className="bg-[#073E36] text-white hover:bg-[#10251F] rounded-[25px] p-5 text-left relative transition-all active:scale-[0.99] cursor-pointer shadow-xs"
          >
            <Users size={18} className="absolute right-5 top-5 text-[#D7F4D4]" />
            <div className="text-xs text-[#B1C9B9] font-medium">Customer dues</div>
            <div className="text-2xl font-extrabold tracking-tight text-white my-2 font-mono tabular-nums">
              {formatCurrency(realPendingAmount)}
            </div>
            <div className="text-[10px] text-[#CDE9C3] font-semibold flex items-center gap-1">
              <span>{overdueInvoicesCount > 0 ? `${overdueInvoicesCount} overdue bills` : 'All accounts clear'} ↗</span>
            </div>
          </button>
        </div>

        {/* 🚀 QUICK ACTIONS (Make your next move) */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[15px] font-bold text-[#102723] tracking-tight">Make your next move</h2>
            <button 
              type="button"
              onClick={() => setIsAllToolsOpen(prev => !prev)} 
              className="text-[11px] font-extrabold text-[#0F645D] hover:underline flex items-center gap-1 cursor-pointer select-none"
            >
              <span>{isAllToolsOpen ? 'Less tools' : 'All tools'}</span>
              <span>{isAllToolsOpen ? '▲' : '▼'}</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => navigate('/invoices/create')}
              className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
            >
              <div className="w-14 h-14 rounded-full bg-[#D7F4D4] border border-[#C6E9C1] flex items-center justify-center text-[#163C2C] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                <FileText size={22} />
              </div>
              <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Invoice</span>
            </button>

            <button
              onClick={() => navigate('/quotations')}
              className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
            >
              <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                <FileCheck size={22} />
              </div>
              <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Quotation</span>
            </button>

            <button
              onClick={() => navigate('/purchases')}
              className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
            >
              <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                <ShoppingBag size={22} />
              </div>
              <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Purchase</span>
            </button>

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

          {/* All tools inline expanded panel */}
          {isAllToolsOpen && (
            <div className="mt-3 pt-3 border-t border-[#E5EBE0] grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => navigate('/customers')}
                className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <Users size={22} />
                </div>
                <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Parties</span>
              </button>

              <button
                onClick={() => navigate('/payments')}
                className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <CreditCard size={22} />
                </div>
                <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Payments</span>
              </button>

              <button
                onClick={() => navigate('/dailybook')}
                className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <BookOpen size={22} />
                </div>
                <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Daily Book</span>
              </button>

              <button
                onClick={() => navigate('/expenses')}
                className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <Receipt size={22} />
                </div>
                <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Expenses</span>
              </button>

              <button
                onClick={() => navigate('/reports')}
                className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <BarChart3 size={22} />
                </div>
                <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Reports</span>
              </button>

              <button
                onClick={() => navigate('/barcode-generator')}
                className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <Barcode size={22} />
                </div>
                <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Barcode</span>
              </button>

              <button
                onClick={() => navigate('/invoices/create?type=challan')}
                className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <Truck size={22} />
                </div>
                <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Delivery</span>
              </button>

              <button
                onClick={() => navigate('/settings')}
                className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-white/60 transition-all cursor-pointer group active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5EBE0] flex items-center justify-center text-[#102723] mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <Settings size={22} />
                </div>
                <span className="text-[11px] font-extrabold text-[#102723] leading-tight">Settings</span>
              </button>
            </div>
          )}
        </div>

        {/* ⚡ QUICK POS SALE PROMINENT BANNER */}
        <button
          onClick={() => navigate('/pos')}
          className="w-full rounded-[22px] bg-[#073E36] hover:bg-[#10251F] text-white p-4 flex items-center gap-3.5 text-left transition-all active:scale-[0.99] cursor-pointer shadow-md group"
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

        {/* 📈 SALES OVERVIEW CHART */}
        <div className="bg-white border border-[#E9EEE4] rounded-[27px] p-5 shadow-xs">
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

          <div className="h-44 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradMobile" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="revenue" stroke="#073E36" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGradMobile)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ⏱ RECENT ACTIVITY & INVOICES LIST */}
        <div className="bg-white border border-[#E9EEE4] rounded-[27px] p-5 shadow-xs">
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
            {recentInvoices.length === 0 ? (
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
              recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  className="py-3.5 flex items-center gap-3 text-left w-full cursor-pointer hover:bg-[#F6F8F3] px-2 rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 flex-shrink-0 rounded-2xl bg-[#EFF5E8] flex items-center justify-center text-[#1C563C] text-xs font-extrabold">
                    {inv.customerName.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <b className="text-xs font-bold text-[#102723] truncate block">{inv.customerName}</b>
                    <small className="text-[10px] text-[#7B8781] block mt-0.5">{inv.invoiceNum} · {inv.date}</small>
                  </div>

                  <button
                    onClick={(e) => handleWhatsAppShare(inv, e)}
                    title="Share invoice summary on WhatsApp"
                    className="p-1.5 rounded-lg bg-[#EFF5E8] text-[#163C2C] hover:bg-[#D7F4D4] transition-colors cursor-pointer"
                  >
                    <MessageCircle size={14} />
                  </button>

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

        {/* 📦 SHELVES READY STOCK ALERT CARD */}
        <button
          onClick={() => navigate('/items?tab=lowstock')}
          className="w-full rounded-[23px] bg-[#ECF0E7] hover:bg-[#E2E9DC] p-4 flex items-center gap-3.5 text-left transition-all active:scale-[0.99] cursor-pointer shadow-xs group"
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

        {/* 🗑 RECYCLE BIN DATA PROTECTION CARD */}
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
      </div>

      {/* ======================================================== */}
      {/* 🖥️ DESKTOP SOFTWARE WORKSPACE VIEW (hidden md:block)       */}
      {/* ======================================================== */}
      <div className="hidden md:block space-y-6 pb-16 font-sans">
        {/* Desktop Header with Good evening, Noman. ✦ and toolbar */}
        <div className="bg-white border border-[#E5EBE0] rounded-[24px] p-4 sm:p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-[-1.5px] leading-[1.2] text-[#102723]">
              {greeting},<br />
              <b className="font-extrabold">{user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Noman'}.</b> ✦
            </h1>
            <p className="text-xs text-[#7B8781] mt-1 font-medium flex items-center gap-1.5">
              <span>A little overview. A lot of possibilities.</span>
              <span>·</span>
              <span className="font-semibold text-[#163C2C]">{storeName}</span>
              {isTrialActive && (
                <>
                  <span>·</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#FCF0CC] text-[#B7892E] text-[10px] font-bold uppercase tracking-wider">
                    Pro Trial Active
                  </span>
                </>
              )}
            </p>
          </div>

        {/* Primary Desktop Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Create Invoice Primary Button */}
          <button
            onClick={() => navigate('/invoices/create')}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#073E36] hover:bg-[#0B4B42] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Create a new GST Tax Invoice (Shortcut: Alt+N)"
          >
            <Plus size={15} />
            <span>New Invoice</span>
            <span className="hidden xl:inline text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono font-normal">Alt+N</span>
          </button>

          {/* Quick POS Register Button */}
          <button
            onClick={() => navigate('/pos')}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#D7F4D4] hover:bg-[#C7EABA] text-[#073E36] text-xs font-bold border border-[#C6E9C1] transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Open High-Speed Retail POS Register (Shortcut: F2)"
          >
            <Zap size={14} className="text-[#0F645D]" />
            <span>POS Register</span>
            <span className="hidden xl:inline text-[9px] bg-[#073E36]/10 px-1 py-0.2 rounded font-mono font-bold">F2</span>
          </button>

          {/* Quotation Button */}
          <button
            onClick={() => navigate('/invoices/create?type=ESTIMATE')}
            className="px-3 py-2 rounded-xl bg-[#F6F8F3] hover:bg-[#E9EFE6] text-[#102723] text-xs font-bold border border-[#E5EBE0] transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Create a new Estimate or Quotation"
          >
            <FileCheck size={14} className="text-[#7B8781]" />
            <span className="hidden sm:inline">New Estimate</span>
          </button>

          {/* Export Report */}
          <button
            onClick={handleExportToday}
            className="px-3 py-2 rounded-xl bg-[#F6F8F3] hover:bg-[#E9EFE6] text-[#102723] text-xs font-bold border border-[#E5EBE0] transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Export billing report to Excel spreadsheet"
          >
            <Download size={14} className="text-[#7B8781]" />
            <span className="hidden sm:inline">Excel Export</span>
          </button>

          {/* Cloud Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-2.5 py-2 rounded-xl bg-[#F6F8F3] hover:bg-[#E9EFE6] text-[#102723] text-xs font-bold border border-[#E5EBE0] transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Sync all database records with Cloud"
          >
            <RefreshCw size={13} className={cn("text-[#163C2C]", isSyncing && "animate-spin")} />
            <span className="text-[11px]">{syncFeedback || (isSyncing ? "Syncing..." : isOfflineMode ? "PC Mode" : "Sync")}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📊 4-COLUMN BALANCED DESKTOP SOFTWARE KPI STATS GRID      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Sales Revenue (with period tabs) */}
        <div className="bg-[#D7F4D4] border border-[#C6E9C1] rounded-[22px] p-4 sm:p-5 relative overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[11px] font-bold text-[#163C2C] uppercase tracking-wider">
                Sales Revenue
              </span>
              <div className="flex bg-[#C6E9C1] p-0.5 rounded-lg gap-0.5">
                {(['Today', 'Week', 'Month', 'Year'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] transition-all cursor-pointer",
                      period === p 
                        ? "bg-white text-[#102723] font-black shadow-2xs" 
                        : "text-[#163C2C] font-semibold hover:bg-white/40"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-2xl sm:text-[27px] font-black tracking-tight text-[#102723] my-1 font-mono tabular-nums">
              {formatCurrency(periodSales)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#163C2C] font-semibold mt-3 pt-2 border-t border-[#C6E9C1]/60">
            <span className="inline-flex items-center gap-1 font-bold">
              ↗ {trends.revGrowthText}
            </span>
            <button 
              onClick={() => navigate('/invoices')} 
              className="text-[#073E36] font-extrabold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              All Invoices ↗
            </button>
          </div>
        </div>

        {/* Metric 2: Payments Received */}
        <div 
          onClick={() => navigate('/payments')}
          className="bg-white border border-[#E5EBE0] hover:border-[#CCD4C8] rounded-[22px] p-4 sm:p-5 relative shadow-xs flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99] group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#7B8781] uppercase tracking-wider">
                Payments Received
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#EFF5E8] flex items-center justify-center text-[#163C2C] group-hover:scale-105 transition-transform">
                <Receipt size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-[27px] font-black tracking-tight text-[#102723] my-1 font-mono tabular-nums">
              {formatCurrency(realTotalRevenue)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#7B8781] font-medium mt-3 pt-2 border-t border-[#EDF1E8]">
            <span>Cash + UPI Collections</span>
            <span className="text-[#0F645D] font-bold group-hover:underline">Open Ledger ↗</span>
          </div>
        </div>

        {/* Metric 3: Customer Dues */}
        <div 
          onClick={() => navigate('/customers?filter=dues')}
          className="bg-white border border-[#E5EBE0] hover:border-[#F6D88E] rounded-[22px] p-4 sm:p-5 relative shadow-xs flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99] group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#B7892E] uppercase tracking-wider">
                Customer Dues (Khata)
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#FCF0CC] flex items-center justify-center text-[#B7892E] group-hover:scale-105 transition-transform">
                <Users size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-[27px] font-black tracking-tight text-[#102723] my-1 font-mono tabular-nums">
              {formatCurrency(realPendingAmount)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#7B8781] font-medium mt-3 pt-2 border-t border-[#EDF1E8]">
            <span className={cn("font-bold", overdueInvoicesCount > 0 ? "text-[#BE3349]" : "text-[#118062]")}>
              {overdueInvoicesCount > 0 ? `${overdueInvoicesCount} overdue bills` : 'All accounts settled'}
            </span>
            <span className="text-[#0F645D] font-bold group-hover:underline">View Khata ↗</span>
          </div>
        </div>

        {/* Metric 4: Inventory & Low Stock Health */}
        <div 
          onClick={() => navigate('/items?tab=lowstock')}
          className="bg-white border border-[#E5EBE0] hover:border-[#CCD4C8] rounded-[22px] p-4 sm:p-5 relative shadow-xs flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99] group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#7B8781] uppercase tracking-wider">
                Stock & Catalog
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#EFF5E8] flex items-center justify-center text-[#163C2C] group-hover:scale-105 transition-transform">
                <Package size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-[27px] font-black tracking-tight text-[#102723] my-1 font-mono tabular-nums">
              {inventoryItems.length} <span className="text-sm font-normal text-[#7B8781]">Products</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#7B8781] font-medium mt-3 pt-2 border-t border-[#EDF1E8]">
            <span className={cn("font-bold", lowStockItems.length > 0 ? "text-[#BE3349]" : "text-[#118062]")}>
              {lowStockItems.length > 0 ? `${lowStockItems.length} items low stock` : 'Stock is healthy'}
            </span>
            <span className="text-[#0F645D] font-bold group-hover:underline">Inventory ↗</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🚀 DESKTOP SOFTWARE MODULES ACCESS BAR                   */}
      {/* ======================================================== */}
      <div className="bg-white border border-[#E5EBE0] rounded-[22px] p-3 sm:p-4 shadow-xs">
        <div className="text-[11px] font-bold text-[#7B8781] uppercase tracking-wider mb-2.5 px-1 flex items-center justify-between">
          <span>Quick Software Modules</span>
          <span className="text-[10px] text-[#163C2C] font-semibold">1-Click Launchers</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: 'Tax Invoice', icon: FileText, path: '/invoices/create', hint: 'Alt+N', color: 'bg-[#D7F4D4] text-[#073E36]' },
            { label: 'POS Register', icon: Zap, path: '/pos', hint: 'F2', color: 'bg-[#073E36] text-white' },
            { label: 'Quotations', icon: FileCheck, path: '/quotations', hint: 'Est.', color: 'bg-[#EFF5E8] text-[#102723]' },
            { label: 'Purchase Bill', icon: ShoppingBag, path: '/purchases', hint: 'Inward', color: 'bg-[#EFF5E8] text-[#102723]' },
            { label: 'Add Product', icon: Package, path: '/items', hint: 'Catalog', color: 'bg-[#EFF5E8] text-[#102723]' },
            { label: 'Customers', icon: Users, path: '/customers', hint: 'Khata', color: 'bg-[#EFF5E8] text-[#102723]' },
            { label: 'Daily Book', icon: Calendar, path: '/dailybook', hint: 'Cash', color: 'bg-[#EFF5E8] text-[#102723]' },
            { label: 'GST Reports', icon: TrendingUp, path: '/reports', hint: 'CA Hub', color: 'bg-[#EFF5E8] text-[#102723]' },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E5EBE0] hover:border-[#CCD4C8] hover:bg-[#F6F8F3] transition-all text-left cursor-pointer active:scale-95 group shadow-2xs"
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold transition-transform group-hover:scale-105", item.color)}>
                <item.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-[#102723] block truncate">{item.label}</span>
                <span className="text-[10px] text-[#7B8781] block truncate font-mono">{item.hint}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📊 MULTI-COLUMN SOFTWARE DESKTOP LAYOUT (8 col + 4 col)  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: Main Chart & Invoices Desktop Table (8 col) */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 space-y-6">
          {/* Sales Performance Chart Card */}
          <div className="bg-white border border-[#E5EBE0] rounded-[24px] p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#102723] uppercase tracking-wide">
                  Sales Overview & Performance Trends
                </h2>
                <div className="text-2xl font-black tracking-tight text-[#102723] my-1 font-mono tabular-nums">
                  {formatCurrency(realTotalRevenue)}
                </div>
                <div className="text-xs text-[#7B8781]">
                  Financial trends derived from active recorded sales and invoices.
                </div>
              </div>

              {/* Functional Time Filter Tabs */}
              <div className="flex items-center bg-[#F6F8F3] p-1 rounded-xl border border-[#E5EBE0] gap-1 self-start sm:self-auto">
                <button
                  onClick={() => setTimeFilter('month')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    timeFilter === 'month' ? "bg-white text-[#102723] shadow-xs" : "text-[#7B8781] hover:text-[#102723]"
                  )}
                >
                  This Month
                </button>
                <button
                  onClick={() => setTimeFilter('6months')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    timeFilter === '6months' ? "bg-white text-[#102723] shadow-xs" : "text-[#7B8781] hover:text-[#102723]"
                  )}
                >
                  Last 6 Mos
                </button>
                <button
                  onClick={() => setTimeFilter('year')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    timeFilter === 'year' ? "bg-white text-[#102723] shadow-xs" : "text-[#7B8781] hover:text-[#102723]"
                  )}
                >
                  This Year
                </button>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-56 sm:h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="softwareSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D7F4D4" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#D7F4D4" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#F0F4EC" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#8A948C" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8A948C" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                  <Tooltip 
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Sales Revenue']}
                    contentStyle={{ backgroundColor: '#073E36', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#073E36" strokeWidth={2.5} fillOpacity={1} fill="url(#softwareSalesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Invoices Desktop Table Card */}
          <div className="bg-white border border-[#E5EBE0] rounded-[24px] p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#102723] uppercase tracking-wide">
                  Recent Invoices & Transactions
                </h2>
                <p className="text-xs text-[#7B8781] mt-0.5">
                  Latest customer billing entries and real-time payment states.
                </p>
              </div>
              <button 
                onClick={() => navigate('/invoices')} 
                className="text-xs font-black text-[#0F645D] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All Invoices ({invoices.length})</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Desktop Software Table */}
            <div className="overflow-x-auto">
              {recentInvoices.length === 0 ? (
                <div className="text-center py-10 text-[#7B8781]">
                  <FileText className="mx-auto text-[#CCD4C8] mb-2" size={32} />
                  <p className="text-xs font-bold text-[#102723]">No recorded transactions yet</p>
                  <button 
                    onClick={() => navigate('/invoices/create')}
                    className="text-xs font-extrabold text-[#073E36] hover:underline mt-1 cursor-pointer"
                  >
                    + Create your first invoice
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E5EBE0] text-[#7B8781] text-[10px] font-bold uppercase tracking-wider">
                      <th className="pb-3 font-bold">Invoice #</th>
                      <th className="pb-3 font-bold">Date</th>
                      <th className="pb-3 font-bold">Customer / Party</th>
                      <th className="pb-3 font-bold">Payment Status</th>
                      <th className="pb-3 font-bold text-right">Amount</th>
                      <th className="pb-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF1E8]">
                    {recentInvoices.map((inv) => (
                      <tr 
                        key={inv.id}
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="hover:bg-[#F6F8F3] transition-colors cursor-pointer group"
                      >
                        <td className="py-3 font-mono font-bold text-[#102723]">
                          <span className="px-2 py-1 rounded-md bg-[#EFF5E8] text-[#163C2C] group-hover:bg-[#D7F4D4] transition-colors">
                            {inv.invoiceNum}
                          </span>
                        </td>
                        <td className="py-3 text-[#7B8781] whitespace-nowrap">
                          {inv.date}
                        </td>
                        <td className="py-3 font-bold text-[#102723] max-w-[180px] truncate">
                          {inv.customerName}
                        </td>
                        <td className="py-3">
                          <span className={cn(
                            "inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full",
                            inv.status === 'paid' 
                              ? "bg-[#DDF3DF] text-[#118062]" 
                              : inv.status === 'overdue' 
                              ? "bg-[#FBE4E8] text-[#BE3349]" 
                              : "bg-[#FCF0CC] text-[#B7892E]"
                          )}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-[#102723] tabular-nums whitespace-nowrap">
                          {formatCurrency(inv.amount, inv.currency)}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => handleWhatsAppShare(inv, e)}
                              title="Share invoice summary on WhatsApp"
                              className="p-1.5 rounded-lg bg-[#EFF5E8] text-[#163C2C] hover:bg-[#D7F4D4] transition-colors cursor-pointer"
                            >
                              <MessageCircle size={13} />
                            </button>
                            <button
                              onClick={() => navigate(`/invoices/${inv.id}`)}
                              title="View Invoice Details"
                              className="p-1.5 rounded-lg bg-[#EFF5E8] text-[#102723] hover:bg-[#E2EBDC] transition-colors cursor-pointer"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: POS, Low-Stock, Debtors & Tools (4 col)   */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 space-y-5">
          {/* ⚡ Quick POS Register Launcher Card */}
          <div className="bg-[#073E36] text-white rounded-[24px] p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-[10px] font-bold text-[#D7F4D4] uppercase tracking-wider block">
                  Point of Sale Terminal
                </span>
                <strong className="text-base font-bold text-white block mt-0.5">
                  High-Speed POS Register
                </strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#D7F4D4]">
                <ScanLine size={20} />
              </div>
            </div>

            <p className="text-xs text-[#B1C9B9] mb-4 leading-relaxed">
              Scan product barcodes, generate thermal bill prints, and accept instant cash & UPI payments.
            </p>

            <button
              onClick={() => navigate('/pos')}
              className="w-full py-2.5 rounded-xl bg-[#D7F4D4] hover:bg-[#C7EABA] text-[#073E36] font-black text-xs transition-all shadow-xs flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              <Zap size={14} />
              <span>Launch Register (F2)</span>
            </button>
          </div>

          {/* ⚠️ Low Stock & Reorder Alerts Widget */}
          <div className="bg-white border border-[#E5EBE0] rounded-[24px] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-[#B7892E]" />
                <h3 className="text-xs font-bold text-[#102723] uppercase tracking-wide">
                  Low Stock Alerts
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FCF0CC] text-[#B7892E]">
                {lowStockItems.length} Need Reorder
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-5 text-center text-xs text-[#7B8781]">
                <CheckCircle2 size={24} className="mx-auto text-[#118062] mb-1.5" />
                <p className="font-semibold text-[#102723]">All catalog stock is healthy</p>
                <p className="text-[11px] text-[#7B8781] mt-0.5">No products under threshold.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-3">
                {lowStockItems.slice(0, 3).map(item => (
                  <div key={item.id} className="p-2.5 rounded-xl bg-[#F6F8F3] border border-[#E5EBE0] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-lg bg-white border border-[#E5EBE0] overflow-hidden shrink-0 flex items-center justify-center text-[#7B8781]">
                        {((item as any).image || (item as any).image_url || (item as any).photo_url) ? (
                          <img
                            src={(item as any).image || (item as any).image_url || (item as any).photo_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package size={14} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-[#102723] block truncate">{item.name}</span>
                        <span className="text-[10px] text-[#7B8781]">Reorder threshold: {item.min_stock_level || item.low_stock_threshold || 5} {item.unit || 'Pcs'}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-[#FBE4E8] text-[#BE3349] font-mono font-bold text-[11px] shrink-0">
                      {item.stock} {item.unit || 'Pcs'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCreatePoForLowStock}
                className="flex-1 py-2 rounded-xl bg-[#EFF5E8] hover:bg-[#E2EBDC] text-[#163C2C] text-xs font-bold transition-all text-center cursor-pointer"
                title="Create a Purchase Order with these items prefilled"
              >
                1-Click Reorder PO
              </button>
              <button
                onClick={() => navigate('/items?tab=lowstock')}
                className="py-2 px-3 rounded-xl border border-[#E5EBE0] hover:bg-[#F6F8F3] text-[#7B8781] hover:text-[#102723] text-xs font-bold transition-all text-center cursor-pointer"
              >
                View
              </button>
            </div>
          </div>

          {/* 👥 Top Outstanding Customer Khata Widget */}
          <div className="bg-white border border-[#E5EBE0] rounded-[24px] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Users size={15} className="text-[#163C2C]" />
                <h3 className="text-xs font-bold text-[#102723] uppercase tracking-wide">
                  Customer Khata Dues
                </h3>
              </div>
              <button
                onClick={() => navigate('/customers?filter=dues')}
                className="text-[11px] font-bold text-[#0F645D] hover:underline"
              >
                All Dues ↗
              </button>
            </div>

            {topDebtorCustomers.length === 0 ? (
              <div className="py-5 text-center text-xs text-[#7B8781]">
                <CheckCircle2 size={24} className="mx-auto text-[#118062] mb-1.5" />
                <p className="font-semibold text-[#102723]">No outstanding balances</p>
                <p className="text-[11px] text-[#7B8781] mt-0.5">All customer accounts are settled.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topDebtorCustomers.map(debtor => (
                  <div key={debtor.id} className="p-2.5 rounded-xl bg-[#F6F8F3] border border-[#E5EBE0] flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-[#102723] block truncate">{debtor.name}</span>
                      <span className="text-[10px] text-[#7B8781]">{debtor.phone || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-[#B7892E] tabular-nums text-xs">
                        {formatCurrency(debtor.pendingTotal)}
                      </span>
                      <button
                        onClick={(e) => handleCustomerDuesReminder(debtor, e)}
                        title="Send WhatsApp payment reminder"
                        className="p-1.5 rounded-lg bg-[#D7F4D4] text-[#163C2C] hover:bg-[#C7EABA] transition-colors cursor-pointer"
                      >
                        <MessageCircle size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🛡️ Data Protection & Recycle Bin Widget */}
          <div className="bg-[#F6F8F3] border border-[#E5EBE0] rounded-[24px] p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-[#163C2C]" />
              <strong className="text-xs font-bold text-[#102723]">Data Integrity & Protection</strong>
            </div>
            <p className="text-[11px] text-[#7B8781] leading-relaxed mb-3">
              Deleted records remain safely stored in your Recycle Bin for 30 days before permanent deletion.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-[#E5EBE0]">
              <span className="text-[11px] text-[#7B8781] font-semibold">
                Bin Storage: <b>{recycleBinItems.length} items</b>
              </span>
              <button
                onClick={() => setIsRecycleBinOpen(true)}
                className="text-xs font-bold text-[#073E36] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Bin</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Recycle Bin Modal */}
    <RecycleBinModal
      isOpen={isRecycleBinOpen}
      onClose={() => setIsRecycleBinOpen(false)}
    />
  </>
);
}
