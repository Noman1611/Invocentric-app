import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, CreditCard, X, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import { OperationType, handleFirestoreError } from '../lib/firebase';
import { usePayments, useCustomers, useInvoices } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { formatCurrency } from '../lib/utils';
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
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 w-fit"
        >
          <Plus size={20} />
          Record Payment
        </button>
      </header>

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
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

      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
