import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Filter, FileText, Trash2, Download, X, Calendar, CheckCircle2, Phone } from 'lucide-react';
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
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl tracking-tight">
            {appMode === 'freelancer' ? 'Invoices Ledger' : 'Financial Ledger'}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {appMode === 'freelancer' ? 'Manage and track your professional freelance consulting and project invoices.' : 'Manage and track your primary business billables.'}
          </p>
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search by ID, Customer, or Item description..." 
              className="input-field pl-12 h-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "btn-secondary flex items-center gap-2 px-6 h-12 justify-center transition-all",
              showFilters && "bg-slate-50 ring-2 ring-green-500/10 border-green-500/20"
            )}
          >
            <Filter size={18} className={cn("transition-colors", showFilters ? "text-green-600" : "text-slate-500")} />
            <span className="text-sm">Filters</span>
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Payment Status</label>
                  <select 
                    className="input-field h-11 bg-white"
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
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Timeline</label>
                  <select 
                    className="input-field h-11 bg-white"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <option value="all">Lifetime</option>
                    <option value="today">Today</option>
                    <option value="week">Past 7 Days</option>
                    <option value="month">Past 30 Days</option>
                    <option value="custom">Custom Selection</option>
                  </select>
                </div>

                {dateFilter === 'custom' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">From</label>
                      <input 
                        type="date" 
                        className="input-field h-11 bg-white"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">To</label>
                      <input 
                        type="date" 
                        className="input-field h-11 bg-white"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={handleExportFiltered}
                    className="btn-secondary h-11 px-4 text-xs font-bold bg-white flex items-center gap-2 flex-1"
                  >
                    <Download size={14} />
                    Export
                  </button>
                  <button 
                    onClick={() => {
                      setStatusFilter('all');
                      setDateFilter('all');
                      setSearchTerm('');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="p-2.5 text-slate-500 hover:text-slate-900 transition-colors"
                    title="Clear Filters"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="card-base overflow-hidden">
        {/* Mobile View: Native Card Stack */}
        <div className="block md:hidden divide-y divide-slate-100/80">
          {loading ? (
            <div className="p-8 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse [animation-delay:-0.2s]" />
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse [animation-delay:-0.4s]" />
              </div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mx-auto mb-3">
                <FileText className="text-slate-400" size={28} />
              </div>
              <p className="text-slate-900 font-bold text-sm">No transaction records</p>
              <p className="text-slate-500 text-xs mt-1">Adjust filters or create a new invoice.</p>
            </div>
          ) : (
            filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to={`/invoices/${invoice.id}`} className="font-bold text-slate-900 hover:text-green-600 transition-colors text-sm flex items-center gap-1.5">
                      #INV-{invoice.id.slice(0, 4).toUpperCase()}
                    </Link>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">{invoice.customer_name || 'Individual Profile'}</p>
                    <span className="text-[10px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                      <Calendar size={10} className="text-slate-400" />
                      {invoice.created_at ? format(parseDateSafe(invoice.created_at), 'MMM d, yyyy') : 'N/A'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </div>
                    <span className={cn(
                      "inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      invoice.status === 'paid' && "bg-green-50 text-green-700",
                      invoice.status === 'sent' && "bg-amber-50 text-amber-700",
                      invoice.status === 'draft' && "bg-slate-100 text-slate-600",
                      invoice.status === 'overdue' && "bg-rose-50 text-rose-700",
                    )}>
                      {invoice.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100/60 text-xs">
                  <span className="text-[11px] text-slate-500">
                    Due: {invoice.due_date ? format(parseDateSafe(invoice.due_date), 'MMM d') : '-'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Link 
                      to={`/invoices/${invoice.id}`}
                      className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 active:scale-95 rounded-xl transition-all"
                      title="View Invoice"
                    >
                      <FileText size={16} />
                    </Link>
                    {invoice.status !== 'paid' && (
                      <button 
                        onClick={() => handleMarkAsPaid(invoice.id)}
                        className="p-2 text-green-600 hover:text-green-700 bg-green-50 active:scale-95 rounded-xl transition-all"
                        title="Record Payment"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(invoice.id)}
                      className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 active:scale-95 rounded-xl transition-all"
                      title="Delete Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Data Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transaction ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest tabular-nums">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Due Date</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse [animation-delay:-0.2s]" />
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse [animation-delay:-0.4s]" />
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mx-auto mb-4">
                        <FileText className="text-slate-500" size={32} />
                      </div>
                      <p className="text-slate-900 font-bold text-sm">No transaction records</p>
                      <p className="text-slate-500 text-xs mt-1">Adjust your filters or start by creating a new invoice.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50/40 transition-colors group">
                  <td className="px-6 py-5">
                    <Link to={`/invoices/${invoice.id}`} className="font-bold text-slate-900 hover:text-green-600 transition-colors block leading-none">
                      #INV-{invoice.id.slice(0, 4).toUpperCase()}
                    </Link>
                    <span className="text-[10px] text-slate-500 mt-1.5 font-medium uppercase tracking-tight flex items-center gap-1.5">
                      <Calendar size={10} className="text-slate-500" />
                      {invoice.created_at ? format(parseDateSafe(invoice.created_at), 'MMM d, yyyy') : 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                       <p className="text-sm font-semibold text-slate-900">{invoice.customer_name || 'Individual Profile'}</p>
                       {invoice.items?.length > 0 && (
                         <p className="text-[11px] text-slate-500 truncate max-w-[200px] mt-0.5">
                           {invoice.items[0].description}
                         </p>
                       )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "badge",
                      invoice.status === 'paid' && "bg-green-50 text-green-700",
                      invoice.status === 'sent' && "bg-amber-50 text-amber-700",
                      invoice.status === 'draft' && "bg-slate-100 text-slate-600",
                      invoice.status === 'overdue' && "bg-rose-50 text-rose-700",
                    )}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-bold text-slate-900 tabular-nums">
                    <div>{formatCurrency(invoice.amount, invoice.currency)}</div>
                    {((invoice.advance_amount || invoice.advanceAmount) > 0) && (
                      <div className="text-[10px] font-semibold text-emerald-600">
                        Adv: {formatCurrency(invoice.advance_amount || invoice.advanceAmount, invoice.currency)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <p className={cn(
                      "text-xs font-medium",
                      invoice.status !== 'paid' && invoice.due_date && parseDateSafe(invoice.due_date) < new Date() ? "text-rose-500 font-bold" : "text-slate-500"
                    )}>
                      {invoice.due_date ? format(parseDateSafe(invoice.due_date), 'MMM d, yyyy') : '-'}
                    </p>
                  </td>
                  <td className="px-3 md:px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5 opacity-100 transition-opacity">
                      <Link 
                        to={`/invoices/${invoice.id}`}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                        title="View Ledger"
                      >
                        <FileText size={16} />
                      </Link>
                      {invoice.status !== 'paid' && (
                        <button 
                          onClick={() => handleMarkAsPaid(invoice.id)}
                          className="p-2 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-all"
                          title="Record Payment"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(invoice.id)}
                        className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-xl transition-all"
                        title="Remove Record"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} />
              </div>
              <h2 className="text-xl mb-2 tracking-tight">Delete transaction?</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                This will permanently remove the record from your ledger. This action cannot be reversed.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="btn-secondary py-2 text-sm"
                >
                  Keep Record
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="bg-rose-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-rose-700 transition-all disabled:opacity-50"
                >
                  {isDeleting ? 'Removing...' : 'Delete Permanently'}
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

