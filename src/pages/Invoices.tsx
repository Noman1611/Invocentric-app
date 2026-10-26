import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Filter, FileText, Trash2, Download, X, Calendar, CheckCircle2, Phone, RefreshCw, Edit3 } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { useInvoices } from '../hooks/useData';
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { dbService, findLinkedPayments } from '../services/dbService';
import { Link, useNavigate } from 'react-router-dom';
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';
import { sendEmail, emailTemplates } from '../services/emailService';
import { formatInvoicesForExcel, exportInvoicesAsMultiSheet } from '../services/excelService';
import { ScrollableTabBar } from '../components/ScrollableTabBar';

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { invoices, loading } = useInvoices();
  const { user, appMode, isOfflineMode } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ... (keeping identical logic handlers)
  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      const invoiceData = invoices.find(inv => inv.id === invoiceId);
      if (!invoiceData) return;

      await dbService.update('invoices', invoiceId, {
        status: 'paid',
      }, { offlineMode: isOfflineMode, userId: user?.uid || '' });

      // Automatically record or update payment in payments collection
      if (user) {
        const existingPayments = await findLinkedPayments(user.uid, invoiceData.id, isOfflineMode);
        const invNum = invoiceData.invoice_number || invoiceData.id.slice(0, 8).toUpperCase();
        const paymentPayload = {
          customer_id: invoiceData.customer_id || null,
          customer_name: invoiceData.customer_name || 'Cash Sale',
          amount: invoiceData.amount || invoiceData.total || 0,
          note: `Invoice #${invNum} Paid`,
          method: 'cash',
          invoice_id: invoiceData.id,
        };

        if (existingPayments.length > 0) {
          for (const p of existingPayments) {
            await dbService.update('payments', p.id, paymentPayload, { offlineMode: isOfflineMode, userId: user.uid });
          }
        } else {
          await dbService.add('payments', {
            ...paymentPayload,
            user_id: user.uid,
            date: new Date().toISOString(),
          }, { offlineMode: isOfflineMode, userId: user.uid });
        }
      }

      // If we are online and customer email exists, try to send the email
      if (!isOfflineMode && invoiceData.customer_id) {
        try {
          const customerDocRef = doc(db, 'customers', invoiceData.customer_id);
          const customerSnap = await getDoc(customerDocRef);

          if (customerSnap.exists()) {
            const customerData = customerSnap.data();
            if (customerData.email) {
              const template = emailTemplates.paymentReceived(
                customerData.name,
                'InvoCentric Professional',
                formatCurrency(invoiceData.amount, invoiceData.currency)
              );
              await sendEmail({
                to: customerData.email,
                ...template
              });
            }
          }
        } catch (emailErr) {
          console.error("Error sending payment received email:", emailErr);
        }
      }
    } catch (error) {
      console.error("Error marking as paid:", error);
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${invoiceId}`);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await dbService.delete('invoices', deletingId, { offlineMode: isOfflineMode, userId: user?.uid || '' });
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      handleFirestoreError(error, OperationType.DELETE, `invoices/${deletingId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = (invoiceId: string) => {
    setDeletingId(invoiceId);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invDate = inv.created_at ? parseDateSafe(inv.created_at) : new Date();
      const now = new Date();

      const matchesSearch = 
        inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (inv.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.items?.some((item: any) => item.description?.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      
      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = isSameDay(invDate, now);
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        matchesDate = invDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        matchesDate = invDate >= monthAgo;
      } else if (dateFilter === 'custom') {
        const start = startDate ? startOfDay(parseDateSafe(startDate)) : null;
        const end = endDate ? endOfDay(parseDateSafe(endDate)) : null;
        if (start && end) {
          matchesDate = invDate >= start && invDate <= end;
        } else if (start) {
          matchesDate = invDate >= start;
        } else if (end) {
          matchesDate = invDate <= end;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [invoices, searchTerm, statusFilter, dateFilter, startDate, endDate]);

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

  const handleExportFiltered = () => {
    if (filteredInvoices.length === 0) {
      alert('No invoices found in current filter.');
      return;
    }
    let filename = `Invoices_Export_${format(new Date(), 'yyyy-MM-dd')}`;
    if (dateFilter === 'custom' && startDate && endDate) {
      filename = `Invoices_${startDate}_to_${endDate}`;
    }
    exportInvoicesAsMultiSheet(filteredInvoices, filename);
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* ======================================================== */}
      {/* 🌟 PAGE HEADER & PRIMARY CTA                            */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B8B7D] mb-1">
            {appMode === 'freelancer' ? 'Consulting & Billing' : 'Billing & Invoicing'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102723] tracking-tight">
            {appMode === 'freelancer' ? 'Invoices Ledger' : 'Invoices & Bills'}
          </h1>
          <p className="text-xs text-[#738375] mt-0.5">
            {appMode === 'freelancer' ? 'Manage and track your professional freelance consulting and project invoices.' : 'Track GST invoices, payments received, and pending balances.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportToday}
            className="px-3.5 py-2.5 rounded-[18px] bg-white border border-[#E1E8DA] text-[#163B2C] text-xs font-bold hover:bg-[#F2F6EF] transition-colors flex items-center gap-1.5 shadow-xs"
            title="Export Today's Invoices"
          >
            <Download size={14} className="text-[#0F645D]" />
            <span>Export Today</span>
          </button>
          
          <Link
            to="/invoices/create"
            className="px-4 py-2.5 rounded-[18px] bg-[#073E36] hover:bg-[#0B4B42] text-white text-xs font-extrabold transition-all shadow-xs flex items-center gap-2 active:scale-98"
          >
            <Plus size={16} />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🔍 SEARCH BAR & FILTER PILLS                             */}
      {/* ======================================================== */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7B8781]" size={17} />
            <input 
              type="text" 
              placeholder="Search by ID, Customer, or Item description..." 
              className="w-full bg-white border border-[#E1E8DA] rounded-[20px] pl-11 pr-4 py-3 text-xs sm:text-sm text-[#102723] placeholder-[#899784] focus:outline-none focus:border-[#0F645D] transition-colors shadow-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-11 sm:h-12 px-4 rounded-[20px] border border-[#E1E8DA] bg-white text-xs font-bold text-[#102723] hover:bg-[#F2F6EF] transition-all flex items-center gap-2 shadow-xs shrink-0 cursor-pointer",
              showFilters && "bg-[#D7F4D4] border-[#9ACB94] text-[#163C2C]"
            )}
          >
            <Filter size={15} className={showFilters ? "text-[#163C2C]" : "text-[#7B8781]"} />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* Quick Status Filter Tabs with ScrollableTabBar */}
        <ScrollableTabBar className="gap-2 pb-1">
          {[
            { id: 'all', label: `All (${invoices.length})` },
            { id: 'paid', label: `Paid (${invoices.filter(i => i.status === 'paid').length})` },
            { id: 'sent', label: `Pending (${invoices.filter(i => i.status === 'sent').length})` },
            { id: 'overdue', label: `Overdue (${invoices.filter(i => i.status === 'overdue').length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border",
                statusFilter === tab.id
                  ? "bg-[#173C2C] text-white border-[#173C2C] shadow-xs"
                  : "bg-white text-[#7B8B7D] border-[#E1E8DA] hover:bg-[#F2F6EF]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </ScrollableTabBar>

        {/* Expandable Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-5 bg-white border border-[#E9EEE4] rounded-[24px] grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B8B7D]">Status</label>
                  <select 
                    className="w-full bg-[#F6F8F3] border border-[#E1E8DA] rounded-[15px] px-3 py-2.5 text-xs font-bold text-[#102723] focus:outline-none focus:border-[#0F645D]"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Transactions</option>
                    <option value="draft">Draft (Unsent)</option>
                    <option value="sent">Sent (Pending)</option>
                    <option value="paid">Paid (Cleared)</option>
                    <option value="overdue">Overdue (Alert)</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B8B7D]">Timeline</label>
                  <select 
                    className="w-full bg-[#F6F8F3] border border-[#E1E8DA] rounded-[15px] px-3 py-2.5 text-xs font-bold text-[#102723] focus:outline-none focus:border-[#0F645D]"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <option value="all">Lifetime</option>
                    <option value="today">Today</option>
                    <option value="week">Past 7 Days</option>
                    <option value="month">Past 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {dateFilter === 'custom' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B8B7D]">From</label>
                      <input 
                        type="date" 
                        className="w-full bg-[#F6F8F3] border border-[#E1E8DA] rounded-[15px] px-3 py-2.5 text-xs text-[#102723] focus:outline-none focus:border-[#0F645D]"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B8B7D]">To</label>
                      <input 
                        type="date" 
                        className="w-full bg-[#F6F8F3] border border-[#E1E8DA] rounded-[15px] px-3 py-2.5 text-xs text-[#102723] focus:outline-none focus:border-[#0F645D]"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button 
                    onClick={handleExportFiltered}
                    className="flex-1 px-4 py-2.5 bg-[#EFF5E8] hover:bg-[#E3EEDB] text-[#163C2C] rounded-[15px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download size={14} />
                    Export Filtered
                  </button>
                  <button 
                    onClick={() => {
                      setStatusFilter('all');
                      setDateFilter('all');
                      setSearchTerm('');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="p-2.5 bg-[#F6F8F3] hover:bg-[#EAEFE5] text-[#7B8781] hover:text-[#102723] rounded-[15px] transition-colors"
                    title="Clear Filters"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ======================================================== */}
      {/* 📋 INVOICE RECORDS LIST (MOBILE CARDS + DESKTOP TABLE)   */}
      {/* ======================================================== */}
      <div className="bg-white border border-[#E9EEE4] rounded-[26px] overflow-hidden shadow-xs">
        {/* Mobile View: Native Card Stack */}
        <div className="block md:hidden divide-y divide-[#EDF1E8]">
          {loading ? (
            <div className="p-10 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2.5 h-2.5 bg-[#0F645D] rounded-full animate-pulse" />
                <div className="w-2.5 h-2.5 bg-[#0F645D] rounded-full animate-pulse [animation-delay:-0.2s]" />
                <div className="w-2.5 h-2.5 bg-[#0F645D] rounded-full animate-pulse [animation-delay:-0.4s]" />
              </div>
              <p className="text-xs text-[#7B8B7D] mt-3 font-semibold">Loading invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 bg-[#EFF5E8] rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#0F645D]">
                <FileText size={26} />
              </div>
              <p className="text-[#102723] font-bold text-sm">No transaction records</p>
              <p className="text-[#7B8B7D] text-xs mt-1">Adjust filters or create your first invoice.</p>
              <Link 
                to="/invoices/create" 
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-extrabold text-[#0F645D] hover:underline"
              >
                <Plus size={14} /> Create Invoice
              </Link>
            </div>
          ) : (
            filteredInvoices.map((invoice) => {
              const invoiceAmount = invoice.amount ?? (invoice as any).total_amount ?? invoice.total ?? 0;
              const customerName = invoice.customer_name || 'Individual Profile';
              return (
                <div 
                  key={invoice.id} 
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                  className="p-4 space-y-3 hover:bg-[#F6F8F3] transition-colors cursor-pointer active:bg-[#EDF2E8]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#EFF5E8] text-[#1C563C] text-xs font-extrabold flex items-center justify-center shrink-0">
                        {customerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[#102723] text-sm">
                          {invoice.invoice_number || `#INV-${invoice.id.slice(0, 4).toUpperCase()}`}
                        </div>
                        <p className="text-xs font-semibold text-[#4F6352] mt-0.5">{customerName}</p>
                        <span className="text-[10px] text-[#7B8B7D] mt-0.5 flex items-center gap-1">
                          <Calendar size={10} className="text-[#899784]" />
                          {invoice.created_at ? format(parseDateSafe(invoice.created_at), 'MMM d, yyyy') : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[#102723] tabular-nums">
                        {formatCurrency(invoiceAmount, invoice.currency)}
                      </div>
                      <span className={cn(
                        "inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        invoice.status === 'paid' && "bg-[#DDF3DF] text-[#167653]",
                        invoice.status === 'sent' && "bg-[#FCF0CC] text-[#9B7121]",
                        invoice.status === 'draft' && "bg-[#EFF5E8] text-[#4F6352]",
                        invoice.status === 'overdue' && "bg-[#FBE4E8] text-[#AC394E]",
                      )}>
                        {invoice.status}
                      </span>
                      {invoice.is_recurring && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#E6F3DF] text-[#167653]">
                            <RefreshCw size={8} />
                            {invoice.recurring_frequency || 'Recurring'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#EDF1E8] text-xs">
                    <span className="text-[11px] text-[#7B8B7D]">
                      Due: {invoice.due_date ? format(parseDateSafe(invoice.due_date), 'MMM d') : '-'}
                    </span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {invoice.is_recurring && (
                        <Link 
                          to={`/invoices/new?renew_from=${invoice.id}`}
                          className="p-2 text-[#0F645D] hover:bg-[#D7F4D4] rounded-xl transition-all"
                          title="Generate Next Cycle / Renew"
                        >
                          <RefreshCw size={15} />
                        </Link>
                      )}
                      <Link 
                        to={`/invoices/edit/${invoice.id}`}
                        className="p-2 text-[#167653] hover:bg-[#DDF3DF] rounded-xl transition-all"
                        title="Edit Invoice"
                      >
                        <Edit3 size={15} />
                      </Link>
                      <Link 
                        to={`/invoices/${invoice.id}`}
                        className="p-2 text-[#7B8B7D] hover:text-[#102723] hover:bg-[#EFF5E8] rounded-xl transition-all"
                        title="View Invoice"
                      >
                        <FileText size={15} />
                      </Link>
                      {invoice.status !== 'paid' && (
                        <button 
                          onClick={() => handleMarkAsPaid(invoice.id)}
                          className="p-2 text-[#167653] hover:bg-[#DDF3DF] rounded-xl transition-all"
                          title="Record Payment"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(invoice.id)}
                        className="p-2 text-[#AC394E] hover:bg-[#FBE4E8] rounded-xl transition-all"
                        title="Delete Record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Full Data Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F6F8F3] border-b border-[#E9EEE4]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider">Client Name</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider tabular-nums">Amount</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1E8]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-[#0F645D] rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-[#0F645D] rounded-full animate-pulse [animation-delay:-0.2s]" />
                      <div className="w-2 h-2 bg-[#0F645D] rounded-full animate-pulse [animation-delay:-0.4s]" />
                    </div>
                    <p className="text-xs text-[#7B8B7D] mt-3 font-semibold">Loading invoices...</p>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="w-14 h-14 bg-[#EFF5E8] rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#0F645D]">
                        <FileText size={28} />
                      </div>
                      <p className="text-[#102723] font-bold text-sm">No transaction records</p>
                      <p className="text-[#7B8B7D] text-xs mt-1">Adjust your filters or create a new invoice.</p>
                      <Link 
                        to="/invoices/create" 
                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-extrabold text-[#0F645D] hover:underline"
                      >
                        <Plus size={14} /> Create Invoice
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.map((invoice) => {
                const invoiceAmount = invoice.amount ?? (invoice as any).total_amount ?? invoice.total ?? 0;
                const customerName = invoice.customer_name || 'Individual Profile';
                return (
                  <tr 
                    key={invoice.id} 
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    className="hover:bg-[#F9FAF7] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-[#102723] group-hover:text-[#0F645D] transition-colors leading-none text-sm">
                        {invoice.invoice_number || `#INV-${invoice.id.slice(0, 4).toUpperCase()}`}
                      </div>
                      <span className="text-[10px] text-[#7B8B7D] mt-1 font-medium flex items-center gap-1">
                        <Calendar size={10} className="text-[#899784]" />
                        {invoice.created_at ? format(parseDateSafe(invoice.created_at), 'MMM d, yyyy') : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <p className="text-xs font-bold text-[#102723]">{customerName}</p>
                        {invoice.items?.length > 0 && (
                          <p className="text-[10px] text-[#7B8B7D] truncate max-w-[200px] mt-0.5">
                            {invoice.items[0].description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        invoice.status === 'paid' && "bg-[#DDF3DF] text-[#167653]",
                        invoice.status === 'sent' && "bg-[#FCF0CC] text-[#9B7121]",
                        invoice.status === 'draft' && "bg-[#EFF5E8] text-[#4F6352]",
                        invoice.status === 'overdue' && "bg-[#FBE4E8] text-[#AC394E]",
                      )}>
                        {invoice.status}
                      </span>
                      {invoice.is_recurring && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#E6F3DF] text-[#167653]">
                            <RefreshCw size={8} />
                            {invoice.recurring_frequency || 'Recurring'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-[#102723] tabular-nums text-xs">
                      <div>{formatCurrency(invoiceAmount, invoice.currency)}</div>
                      {((invoice.advance_amount || invoice.advanceAmount) > 0) && (
                        <div className="text-[10px] font-semibold text-[#167653]">
                          Adv: {formatCurrency(invoice.advance_amount || invoice.advanceAmount, invoice.currency)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className={cn(
                        "text-xs font-semibold",
                        invoice.status !== 'paid' && invoice.due_date && parseDateSafe(invoice.due_date) < new Date() ? "text-[#AC394E]" : "text-[#7B8B7D]"
                      )}>
                        {invoice.due_date ? format(parseDateSafe(invoice.due_date), 'MMM d, yyyy') : '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {invoice.is_recurring && (
                          <Link 
                            to={`/invoices/new?renew_from=${invoice.id}`}
                            className="p-2 text-[#0F645D] hover:bg-[#D7F4D4] rounded-xl transition-all"
                            title="Generate Next Cycle / Renew"
                          >
                            <RefreshCw size={15} />
                          </Link>
                        )}
                        <Link 
                          to={`/invoices/edit/${invoice.id}`}
                          className="p-2 text-[#167653] hover:bg-[#DDF3DF] rounded-xl transition-all"
                          title="Edit Invoice"
                        >
                          <Edit3 size={15} />
                        </Link>
                        <Link 
                          to={`/invoices/${invoice.id}`}
                          className="p-2 text-[#7B8B7D] hover:text-[#102723] hover:bg-[#EFF5E8] rounded-xl transition-all"
                          title="View Ledger"
                        >
                          <FileText size={15} />
                        </Link>
                        {invoice.status !== 'paid' && (
                          <button 
                            onClick={() => handleMarkAsPaid(invoice.id)}
                            className="p-2 text-[#167653] hover:bg-[#DDF3DF] rounded-xl transition-all"
                            title="Record Payment"
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(invoice.id)}
                          className="p-2 text-[#AC394E] hover:bg-[#FBE4E8] rounded-xl transition-all"
                          title="Remove Record"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ⚠️ DELETE CONFIRMATION MODAL                             */}
      {/* ======================================================== */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-[#10251F]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="relative w-full max-w-sm bg-white rounded-[26px] border border-[#E9EEE4] shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-14 h-14 bg-[#FBE4E8] text-[#AC394E] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h2 className="text-lg font-bold text-[#102723] mb-1 tracking-tight">Delete transaction?</h2>
              <p className="text-xs text-[#7B8B7D] mb-6 leading-relaxed">
                This will permanently remove the record from your ledger. This action cannot be reversed.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2.5 rounded-[16px] bg-[#EFF5E8] hover:bg-[#E3EEDB] text-[#163C2C] text-xs font-bold transition-colors cursor-pointer"
                >
                  Keep Record
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2.5 rounded-[16px] bg-[#AC394E] hover:bg-[#922D3E] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? 'Removing...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple CheckCircle2 placeholder if not imported? No, I'll use Lucide's if I can find it or just stick to what works. 
// Ah, check-circle-2 is CheckCircle2 in lucide-react. I'll add it to imports.

