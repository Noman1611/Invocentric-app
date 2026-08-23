import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileEdit, 
  Plus, 
  Search, 
  Filter, 
  Download,
  MoreVertical,
  Calendar,
  Clock,
  ArrowRight,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvoices, useCustomers } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export default function Quotations() {
  const navigate = useNavigate();
  const { invoices, loading } = useInvoices();
  const { customers } = useCustomers();
  const { user, appMode, isOfflineMode } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const quotations = useMemo(() => {
    return invoices.filter(inv => inv.bill_type === 'ESTIMATE' || inv.bill_type === 'QUOTATION');
  }, [invoices]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const customer = customers.find(c => c.id === q.customer_id);
      return (
        q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [quotations, customers, searchTerm]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await dbService.delete('invoices', deletingId, { offlineMode: isOfflineMode, userId: user?.uid || '' });
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting quotation:", error);
      handleFirestoreError(error, OperationType.DELETE, `invoices/${deletingId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const getQuotationDate = (q: any) => {
    if (!q.created_at) return 'N/A';
    if (q.created_at?.toDate) return format(q.created_at.toDate(), 'dd MMM yyyy');
    if (q.created_at?.seconds) return format(new Date(q.created_at.seconds * 1000), 'dd MMM yyyy');
    try {
      return format(parseDateSafe(q.created_at), 'dd MMM yyyy');
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight uppercase">
            {appMode === 'freelancer' ? 'Estimates & Proposals' : 'Quotations'}
          </h1>
          <p className="text-neutral-500 font-bold text-sm mt-1 uppercase tracking-wider">
            {appMode === 'freelancer' ? 'Manage estimates and project proposals' : 'Manage estimates and customer quotes'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-3 text-neutral-400 hover:text-neutral-900 bg-white border border-neutral-100 rounded-2xl shadow-sm transition-all text-[10px]">
            <Download size={20} />
          </button>
          <button 
            onClick={() => navigate('/invoices/create?type=ESTIMATE')}
            className="flex items-center gap-2 px-6 py-3 bg-[#000000] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] shadow-xl shadow-neutral-900/10 hover:translate-y-[-2px] transition-all active:scale-95"
          >
            <Plus size={16} />
            {appMode === 'freelancer' ? 'New Proposal / Estimate' : 'New Quotation'}
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="glass-card bg-white border border-neutral-100 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative flex-1 max-w-md px-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text" 
              placeholder={appMode === 'freelancer' ? "SEARCH PROPOSALS & ESTIMATES..." : "SEARCH QUOTATIONS..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-400 focus:ring-2 focus:ring-black transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-neutral-500 uppercase tracking-widest hover:bg-neutral-50 rounded-xl transition-all">
              <Filter size={14} />
              Status: All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto px-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">Quote ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">Customer</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredQuotations.map((q) => {
                const customer = customers.find(c => c.id === q.customer_id);
                return (
                  <tr key={q.id} className="hover:bg-neutral-50/50 transition-all group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-neutral-900 uppercase tracking-widest">#{q.id.slice(0, 8).toUpperCase()}</span>
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">{q.bill_type || 'ESTIMATE'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
                          <span className="text-[10px] font-black uppercase text-neutral-400">
                            {customer?.name?.[0] || 'C'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-neutral-900 uppercase tracking-tight">{customer?.name || 'Walk-in Customer'}</span>
                          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{customer?.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                        <Calendar size={12} className="text-neutral-300" />
                        {getQuotationDate(q)}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <span className="text-sm font-black text-neutral-900 tracking-tight">
                        {formatCurrency(q.amount, q.currency || 'INR')}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => navigate(`/invoices/create?from_quotation=${q.id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                          title="Convert to Final Tax Invoice"
                        >
                          <span>Convert to Invoice</span>
                          <ArrowRight size={13} />
                        </button>
                        <button 
                          onClick={() => navigate(`/invoices/${q.id}`)}
                          className="p-2 text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer"
                          title="View Quotation"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(q.id)}
                          className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-xl transition-all cursor-pointer"
                          title="Delete Quotation"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredQuotations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 rounded-full bg-neutral-50">
                        <FileEdit size={40} className="text-neutral-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-neutral-900 uppercase tracking-tight">No quotations found</p>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Create your first professional estimate</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
              <h2 className="text-2xl font-black mb-2">Delete Quotation?</h2>
              <p className="text-neutral-500 mb-8">
                Are you sure you want to delete this quotation? This action cannot be undone.
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
