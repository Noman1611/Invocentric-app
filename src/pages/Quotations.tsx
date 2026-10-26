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
    <div className="space-y-6 pb-16 font-sans">
      {/* ======================================================== */}
      {/* 🌟 PAGE HEADER & CREATE ESTIMATE CTA                     */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B8B7D] mb-1">
            {appMode === 'freelancer' ? 'Proposals & Estimates' : 'Estimates & Quotations'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102723] tracking-tight">
            {appMode === 'freelancer' ? 'Estimates & Proposals' : 'Quotations'}
          </h1>
          <p className="text-xs text-[#738375] mt-0.5">
            {appMode === 'freelancer' ? 'Manage estimates and project proposals with 1-click conversion' : 'Manage price estimates and client quotations with 1-click conversion'}
          </p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => navigate('/invoices/create?type=ESTIMATE')}
            className="px-4 py-2.5 rounded-[18px] bg-[#073E36] hover:bg-[#0B4B42] text-white text-xs font-extrabold transition-all shadow-xs flex items-center gap-2 active:scale-98 cursor-pointer"
          >
            <Plus size={16} />
            <span>{appMode === 'freelancer' ? 'New Proposal / Estimate' : 'New Quotation'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🔍 SEARCH AND CONTROLS                                    */}
      {/* ======================================================== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7B8781]" size={17} />
          <input 
            type="text" 
            placeholder={appMode === 'freelancer' ? "Search proposals & estimates..." : "Search quotations by ID, customer..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[#E1E8DA] rounded-[20px] pl-11 pr-4 py-3 text-xs sm:text-sm text-[#102723] placeholder-[#899784] focus:outline-none focus:border-[#0F645D] transition-colors shadow-xs"
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📋 QUOTATION LIST (MOBILE CARDS + DESKTOP TABLE)         */}
      {/* ======================================================== */}
      <div className="bg-white border border-[#E9EEE4] rounded-[26px] overflow-hidden shadow-xs">
        {/* Mobile View: Native Card Stack */}
        <div className="block md:hidden divide-y divide-[#EDF1E8]">
          {filteredQuotations.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 bg-[#EFF5E8] rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#0F645D]">
                <FileEdit size={26} />
              </div>
              <p className="text-[#102723] font-bold text-sm">No quotations found</p>
              <p className="text-[#7B8B7D] text-xs mt-1">Create your first price estimate.</p>
              <button 
                onClick={() => navigate('/invoices/create?type=ESTIMATE')}
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-extrabold text-[#0F645D] hover:underline cursor-pointer"
              >
                <Plus size={14} /> Create Quotation
              </button>
            </div>
          ) : (
            filteredQuotations.map((q) => {
              const customer = customers.find(c => c.id === q.customer_id);
              const customerName = customer?.name || q.customer_name || 'Walk-in Customer';
              return (
                <div key={q.id} className="p-4 space-y-3 hover:bg-[#F6F8F3] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#EFF5E8] text-[#1C563C] text-xs font-extrabold flex items-center justify-center shrink-0">
                        {customerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-extrabold text-[#102723] block">#{q.id.slice(0, 8).toUpperCase()}</span>
                        <span className="text-xs font-semibold text-[#4F6352] mt-0.5 block">{customerName}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#7B8B7D]">
                          <Calendar size={10} className="text-[#899784]" />
                          <span>{getQuotationDate(q)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-[#102723] tracking-tight block tabular-nums">
                        {formatCurrency(q.amount, q.currency || 'INR')}
                      </span>
                      <span className="inline-block mt-1 text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-[#EFF5E8] text-[#167653] uppercase tracking-wider">
                        {q.bill_type || 'ESTIMATE'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#EDF1E8] gap-2">
                    <button 
                      onClick={() => navigate(`/invoices/create?from_quotation=${q.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D7F4D4] hover:bg-[#C6E9C1] active:scale-95 text-[#163C2C] font-extrabold rounded-[12px] text-xs transition-all shadow-xs cursor-pointer"
                    >
                      <span>Convert to Invoice</span>
                      <ArrowRight size={13} />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => navigate(`/invoices/${q.id}`)}
                        className="p-2 text-[#7B8B7D] hover:text-[#102723] hover:bg-[#EFF5E8] rounded-xl transition-all cursor-pointer"
                        title="View Quotation"
                      >
                        <ExternalLink size={15} />
                      </button>
                      <button 
                        onClick={() => handleDelete(q.id)}
                        className="p-2 text-[#AC394E] hover:bg-[#FBE4E8] rounded-xl transition-all cursor-pointer"
                        title="Delete Quotation"
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
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider">Quote ID</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider text-right tabular-nums">Amount</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-[#7B8B7D] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1E8]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-[#0F645D] rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-[#0F645D] rounded-full animate-pulse [animation-delay:-0.2s]" />
                      <div className="w-2 h-2 bg-[#0F645D] rounded-full animate-pulse [animation-delay:-0.4s]" />
                    </div>
                    <p className="text-xs text-[#7B8B7D] mt-3 font-semibold">Loading quotations...</p>
                  </td>
                </tr>
              ) : filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="w-14 h-14 bg-[#EFF5E8] rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#0F645D]">
                        <FileEdit size={28} />
                      </div>
                      <p className="text-[#102723] font-bold text-sm">No quotations found</p>
                      <p className="text-[#7B8B7D] text-xs mt-1">Create your first price estimate.</p>
                      <button 
                        onClick={() => navigate('/invoices/create?type=ESTIMATE')}
                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-extrabold text-[#0F645D] hover:underline cursor-pointer"
                      >
                        <Plus size={14} /> Create Quotation
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => {
                  const customer = customers.find(c => c.id === q.customer_id);
                  const customerName = customer?.name || q.customer_name || 'Walk-in Customer';
                  return (
                    <tr key={q.id} className="hover:bg-[#F9FAF7] transition-colors group cursor-pointer" onClick={() => navigate(`/invoices/${q.id}`)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-extrabold text-[#102723] leading-none">#{q.id.slice(0, 8).toUpperCase()}</span>
                          <span className="text-[10px] text-[#7B8B7D] uppercase font-bold mt-1">{q.bill_type || 'ESTIMATE'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#EFF5E8] text-[#1C563C] text-[11px] font-extrabold flex items-center justify-center shrink-0">
                            {customerName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-[#102723]">{customerName}</span>
                            {customer?.phone && <span className="text-[10px] text-[#7B8B7D]">{customer.phone}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-[#7B8B7D] font-medium">
                          <Calendar size={12} className="text-[#899784]" />
                          <span>{getQuotationDate(q)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-xs font-extrabold text-[#102723] tabular-nums">
                          {formatCurrency(q.amount, q.currency || 'INR')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => navigate(`/invoices/create?from_quotation=${q.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D7F4D4] hover:bg-[#C6E9C1] active:scale-95 text-[#163C2C] font-extrabold rounded-[12px] text-xs transition-all shadow-xs cursor-pointer"
                          >
                            <span>Convert to Invoice</span>
                            <ArrowRight size={13} />
                          </button>
                          <button 
                            onClick={() => navigate(`/invoices/${q.id}`)}
                            className="p-2 text-[#7B8B7D] hover:text-[#102723] hover:bg-[#EFF5E8] rounded-xl transition-all cursor-pointer"
                            title="View Quotation"
                          >
                            <ExternalLink size={15} />
                          </button>
                          <button 
                            onClick={() => handleDelete(q.id)}
                            className="p-2 text-[#AC394E] hover:bg-[#FBE4E8] rounded-xl transition-all cursor-pointer"
                            title="Delete Quotation"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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
              <h2 className="text-lg font-bold text-[#102723] mb-1 tracking-tight">Delete quotation?</h2>
              <p className="text-xs text-[#7B8B7D] mb-6 leading-relaxed">
                This will permanently remove this estimate record. This action cannot be reversed.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2.5 rounded-[16px] bg-[#EFF5E8] hover:bg-[#E3EEDB] text-[#163C2C] text-xs font-bold transition-colors cursor-pointer"
                >
                  Keep Quote
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
