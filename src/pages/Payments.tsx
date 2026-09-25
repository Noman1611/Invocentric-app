import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, CreditCard, X, Trash2, FileText, CheckCircle2, Building2, Upload, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { OperationType, handleFirestoreError } from '../lib/firebase';
import { usePayments, useCustomers, useInvoices } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';

export default function PaymentsPage() {
  const { user, isOfflineMode } = useAuth();
  const { customers } = useCustomers();
  const { invoices } = useInvoices();
  const { payments, loading } = usePayments();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  // Bank Statement Reconciliation State
  const statementFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileMatches, setReconcileMatches] = useState<Array<{
    id: string;
    date: string;
    narration: string;
    amount: number;
    invoice: any;
    customer: any;
    confidence: 'High' | 'Medium';
    selected: boolean;
  }>>([]);
  const [reconcileSuccessMsg, setReconcileSuccessMsg] = useState<string | null>(null);
  const [reconcileErrorMsg, setReconcileErrorMsg] = useState<string | null>(null);

  const handleBankStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReconciling(true);
    setReconcileErrorMsg(null);
    setReconcileSuccessMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!rows || rows.length === 0) {
            setReconcileErrorMsg("No data rows found in the uploaded statement.");
            setIsReconciling(false);
            return;
          }

          const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');
          const matches: any[] = [];

          rows.forEach((row, idx) => {
            // Find Amount / Credit column
            let creditAmt = 0;
            let narration = '';
            let dateStr = new Date().toISOString().split('T')[0];

            for (const [key, val] of Object.entries(row)) {
              const k = key.toLowerCase();
              const v = String(val).trim();

              if (k.includes('credit') || k.includes('deposit') || k.includes('cr') || k === 'amount') {
                const parsed = parseFloat(v.replace(/[^0-9.-]/g, ''));
                if (!isNaN(parsed) && parsed > 0) {
                  creditAmt = parsed;
                }
              }
              if (k.includes('narration') || k.includes('description') || k.includes('particular') || k.includes('remark')) {
                narration = v;
              }
              if (k.includes('date') || k.includes('txn date')) {
                dateStr = v || dateStr;
              }
            }

            if (creditAmt > 0) {
              const narrLower = narration.toLowerCase();

              // Match against unpaid invoices
              const matchingInv = unpaidInvoices.find(inv => {
                const invAmt = Number(inv.amount || inv.total || 0);
                const invNum = (inv.invoice_number || '').toLowerCase();
                const custName = (inv.customer_name || '').toLowerCase();

                // Exact amount match
                const amtMatch = Math.abs(invAmt - creditAmt) < 1;
                const nameMatch = custName && narrLower.includes(custName.split(' ')[0]);
                const numMatch = invNum && narrLower.includes(invNum);

                return (amtMatch && (nameMatch || numMatch)) || amtMatch;
              });

              if (matchingInv) {
                const cust = customers.find(c => c.id === matchingInv.customer_id);
                const nameMatch = cust && narrLower.includes(cust.name.toLowerCase().split(' ')[0]);
                const numMatch = matchingInv.invoice_number && narrLower.includes(matchingInv.invoice_number.toLowerCase());

                matches.push({
                  id: `match-${idx}-${Date.now()}`,
                  date: dateStr,
                  narration: narration || `Bank Credit ₹${creditAmt}`,
                  amount: creditAmt,
                  invoice: matchingInv,
                  customer: cust || { name: matchingInv.customer_name || 'Customer' },
                  confidence: (nameMatch || numMatch) ? 'High' : 'Medium',
                  selected: true
                });
              }
            }
          });

          if (matches.length === 0) {
            setReconcileErrorMsg("No matching unpaid invoices found for the credits in this statement.");
          } else {
            setReconcileMatches(matches);
            setShowReconcileModal(true);
          }
        } catch (parseErr: any) {
          console.error("Statement parse error:", parseErr);
          setReconcileErrorMsg("Failed to parse statement: " + (parseErr.message || "Invalid file format"));
        } finally {
          setIsReconciling(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      console.error("File reading error:", err);
      setReconcileErrorMsg("Could not read file: " + err.message);
      setIsReconciling(false);
    }
  };

  const handleConfirmReconcile = async () => {
    if (!user) return;
    const toReconcile = reconcileMatches.filter(m => m.selected);
    if (toReconcile.length === 0) {
      alert("Please select at least one matched transaction to reconcile.");
      return;
    }

    setIsSubmitting(true);
    try {
      for (const item of toReconcile) {
        // 1. Add payment record
        await dbService.add('payments', {
          user_id: user.uid,
          customer_id: item.invoice.customer_id || '',
          customer_name: item.customer.name || item.invoice.customer_name || 'Customer',
          amount: item.amount,
          date: new Date().toISOString(),
          note: `Bank Auto-Reconciled: ${item.narration.slice(0, 80)}`,
          invoice_id: item.invoice.id,
          method: 'bank_transfer',
        }, { offlineMode: isOfflineMode, userId: user.uid });

        // 2. Mark invoice as paid
        await dbService.update('invoices', item.invoice.id, {
          status: 'paid',
        }, { offlineMode: isOfflineMode, userId: user.uid });
      }

      setShowReconcileModal(false);
      setReconcileMatches([]);
      setReconcileSuccessMsg(`Successfully reconciled ${toReconcile.length} payments and marked invoices paid!`);
      setTimeout(() => setReconcileSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Reconciliation execution error:", err);
      alert("Error reconciling: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const [formData, setFormData] = useState({
    customerId: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    note: '',
  });

  const pendingInvoices = invoices.filter(inv => inv.status !== 'paid');

  const handleInvoiceSelect = (invId: string) => {
    setSelectedInvoiceId(invId);
    if (!invId) return;
    const inv = pendingInvoices.find(i => i.id === invId);
    if (inv) {
      const invNum = inv.invoice_number || inv.id.slice(0, 8).toUpperCase();
      setFormData(prev => ({
        ...prev,
        customerId: inv.customer_id || '',
        amount: (inv.amount || 0).toString(),
        note: `Payment for Invoice #${invNum}`,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.customerId || !formData.amount) return;

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === formData.customerId);
      const customerName = customer?.name || 'Cash Sale';

      await dbService.add('payments', {
        user_id: user.uid,
        customer_id: formData.customerId,
        customer_name: customerName,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString(),
        note: formData.note,
        invoice_id: selectedInvoiceId || null,
        method: 'cash',
      }, { offlineMode: isOfflineMode, userId: user.uid });

      if (selectedInvoiceId) {
        await dbService.update('invoices', selectedInvoiceId, {
          status: 'paid',
        }, { offlineMode: isOfflineMode, userId: user.uid });
      }

      setShowAddModal(false);
      setSelectedInvoiceId('');
      setFormData({
        customerId: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        note: '',
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const paymentToDelete = payments.find(p => p.id === deletingId);
      await dbService.delete('payments', deletingId, { offlineMode: isOfflineMode, userId: user?.uid || '' });
      
      if (paymentToDelete?.invoice_id) {
        const linkedInvoice = invoices.find(i => i.id === paymentToDelete.invoice_id);
        if (linkedInvoice) {
          await dbService.update('invoices', paymentToDelete.invoice_id, {
            status: 'sent',
          }, { offlineMode: isOfflineMode, userId: user?.uid || '' });
        }
      }
      
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting payment:", error);
      handleFirestoreError(error, OperationType.DELETE, `payments/${deletingId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = (paymentId: string) => {
    setDeletingId(paymentId);
  };

  const filteredPayments = payments.filter(p => {
    const customer = customers.find(c => c.id === p.customer_id);
    const customerName = customer?.name.toLowerCase() || '';
    const note = p.note?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return customerName.includes(search) || note.includes(search);
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-neutral-500 mt-1">Track money coming into your business.</p>
        </div>
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          <input
            type="file"
            ref={statementFileInputRef}
            accept=".csv, .xlsx, .xls"
            onChange={handleBankStatementUpload}
            className="hidden"
          />
          <button
            onClick={() => statementFileInputRef.current?.click()}
            disabled={isReconciling}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
            title="Auto-match bank deposits with pending invoices"
          >
            {isReconciling ? (
              <>
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                <span>Reconciling...</span>
              </>
            ) : (
              <>
                <Building2 size={16} className="text-emerald-600" />
                <span>Bank Statement Reconcile</span>
              </>
            )}
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 w-fit"
          >
            <Plus size={20} />
            Record Payment
          </button>
        </div>
      </header>

      {reconcileSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{reconcileSuccessMsg}</span>
        </div>
      )}
      {reconcileErrorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span>{reconcileErrorMsg}</span>
        </div>
      )}

      <div className="relative">
        <label htmlFor="paymentSearch" className="sr-only">Search Payments</label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
        <input 
          id="paymentSearch"
          type="text" 
          placeholder="Search by customer name or note..." 
          className="input-field pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-neutral-500 font-bold uppercase tracking-widest animate-pulse">Loading payments...</div>
      ) : filteredPayments.length === 0 ? (
        <div className="glass-card py-20 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400">
                <CreditCard size={24} />
              </div>
              <p className="text-neutral-500 font-bold uppercase tracking-tight">No payments recorded yet</p>
            </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Mobile View: Native Card Stack */}
          <div className="block md:hidden divide-y divide-neutral-100">
            {filteredPayments.map((payment) => {
              const customer = customers.find(c => c.id === payment.customer_id);
              return (
                <div key={payment.id} className="p-4 space-y-2 hover:bg-neutral-50/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-xs font-black uppercase text-neutral-600 shrink-0">
                        {customer?.name.charAt(0) || '?'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-neutral-900 block">{customer?.name || 'Unknown Customer'}</span>
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block mt-0.5">
                          {payment.date ? format(parseDateSafe(payment.date), 'dd MMM yyyy') : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-green-600 tabular-nums block">
                        +{formatCurrency(payment.amount, 'INR')}
                      </span>
                      {payment.payment_method && (
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block mt-0.5">
                          {payment.payment_method}
                        </span>
                      )}
                    </div>
                  </div>

                  {payment.note && (
                    <p className="text-xs text-neutral-500 bg-neutral-50 p-2 rounded-lg text-[11px]">
                      {payment.note}
                    </p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button 
                      onClick={() => handleDelete(payment.id)}
                      className="p-1.5 text-rose-600 bg-rose-50 active:scale-95 rounded-lg transition-all"
                      title="Delete Payment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Full Data Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50/50 border-b border-neutral-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Customer</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Note</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Amount</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredPayments.map((payment) => {
                  const customer = customers.find(c => c.id === payment.customer_id);
                  return (
                    <tr key={payment.id} className="hover:bg-neutral-50/30 transition-colors group">
                      <td className="px-6 py-4 text-sm font-bold text-neutral-900 tabular-nums">
                        {payment.date ? format(parseDateSafe(payment.date), 'dd MMM yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center text-[10px] font-black uppercase">
                            {customer?.name.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-bold text-neutral-900">{customer?.name || 'Unknown Customer'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-500 truncate max-w-xs lowercase first-letter:uppercase">
                        {payment.note || '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black text-green-600 tabular-nums">
                        {formatCurrency(payment.amount, 'INR')}
                      </td>
                      <td className="px-3 md:px-6 py-4 text-right whitespace-nowrap">
                         <button 
                           onClick={() => handleDelete(payment.id)}
                           className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-xl transition-all"
                           title="Delete Payment"
                         >
                           <Trash2 size={16} />
                         </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="relative w-[calc(100%-1.5rem)] max-w-lg bg-white rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] p-5 sm:p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">Record Payment</h2>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Invoice Selection Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Link Pending Invoice (Optional)
                    </label>
                    {selectedInvoiceId && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={12} /> Invoice Linked
                      </span>
                    )}
                  </div>
                  <select 
                    className="input-field border-slate-300 focus:ring-green-500"
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                  >
                    <option value="">-- Direct Payment (No Invoice Linked) --</option>
                    {pendingInvoices.map(inv => {
                      const num = inv.invoice_number || inv.id.slice(0, 8).toUpperCase();
                      const name = inv.customer_name || 'Customer';
                      const amt = inv.amount || inv.total || 0;
                      return (
                        <option key={inv.id} value={inv.id}>
                          Invoice #{num} • {name} (₹{amt}) [{inv.status || 'unpaid'}]
                        </option>
                      );
                    })}
                  </select>
                  {pendingInvoices.length === 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">No pending unpaid invoices found.</p>
                  )}
                  {selectedInvoiceId && (
                    <p className="text-[11px] text-emerald-600 font-medium mt-1.5 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                      <FileText size={14} />
                      Selecting this will auto-fill amount & customer, and automatically mark Invoice as PAID upon saving!
                    </p>
                  )}
                </div>

                <div>
                  <label className="label block mb-1.5">Select Customer</label>
                  <select 
                    required
                    className="input-field"
                    value={formData.customerId}
                    onChange={(e) => setFormData(p => ({ ...p, customerId: e.target.value }))}
                  >
                    <option value="">Choose a customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label block mb-2">Amount (₹)</label>
                    <input 
                      type="number" 
                      required
                      className="input-field" 
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleaned = val.replace(/^0+(?=\d)/, '');
                        e.target.value = cleaned;
                        setFormData(p => ({ ...p, amount: cleaned }));
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  <div>
                    <label className="label block mb-2">Date</label>
                    <input 
                      type="date" 
                      required
                      className="input-field" 
                      value={formData.date}
                      onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label block mb-2">Note</label>
                  <textarea 
                    className="input-field min-h-[100px]" 
                    placeholder="e.g. Cash payment, Bank transfer ref..."
                    value={formData.note}
                    onChange={(e) => setFormData(p => ({ ...p, note: e.target.value }))}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary flex-1"
                  >
                    {isSubmitting ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bank Statement Auto-Reconcile Modal */}
      <AnimatePresence>
        {showReconcileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReconcileModal(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="relative w-[calc(100%-1.5rem)] max-w-2xl bg-white rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] p-5 sm:p-8"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-neutral-900 uppercase tracking-tight">
                      Bank Statement Auto-Match
                    </h2>
                    <p className="text-xs font-semibold text-neutral-400">
                      Matched {reconcileMatches.length} deposits against pending invoices
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowReconcileModal(false)}
                  className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-400 hover:text-neutral-700"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Matched list */}
              <div className="space-y-3 mb-6 max-h-[45vh] overflow-y-auto pr-1">
                {reconcileMatches.map((m, idx) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setReconcileMatches(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
                    }}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3",
                      m.selected ? "bg-emerald-50/50 border-emerald-300" : "bg-neutral-50/60 border-neutral-200 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={m.selected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-neutral-900 truncate">{m.customer?.name || 'Customer'}</span>
                          <span className="font-mono text-[10px] text-neutral-500 bg-white border border-neutral-200 px-1.5 py-0.5 rounded">
                            #{m.invoice?.invoice_number || m.invoice?.id?.slice(0, 6)}
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase",
                            m.confidence === 'High' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          )}>
                            {m.confidence} Match
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate mt-0.5 max-w-sm">
                          {m.narration} · {m.date}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-emerald-700 block">
                        +{formatCurrency(m.amount, 'INR')}
                      </span>
                      <span className="text-[9px] text-neutral-400 font-semibold">Matched Deposit</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary and Confirm Action */}
              <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-neutral-500 font-semibold block">
                    {reconcileMatches.filter(m => m.selected).length} of {reconcileMatches.length} selected
                  </span>
                  <span className="text-base font-black text-neutral-900">
                    Total: {formatCurrency(reconcileMatches.filter(m => m.selected).reduce((s, c) => s + c.amount, 0), 'INR')}
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowReconcileModal(false)}
                    className="flex-1 sm:flex-initial px-5 py-3 text-xs font-bold text-neutral-500 hover:text-neutral-800 uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || reconcileMatches.filter(m => m.selected).length === 0}
                    onClick={handleConfirmReconcile}
                    className="flex-1 sm:flex-initial px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Reconciling...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Reconcile Selected ({reconcileMatches.filter(m => m.selected).length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2">Delete Payment?</h2>
              <p className="text-neutral-500 mb-8">
                Are you sure you want to delete this payment record? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="btn-primary flex-1 bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 text-white"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
