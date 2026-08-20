import { useState, useMemo } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Receipt, 
  Trash2, 
  Edit3, 
  Calendar,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../hooks/useData';
import { dbService } from '../services/dbService';

export default function Expenses() {
  const { user, isOfflineMode } = useAuth();
  const { expenses, loading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'General',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash'
  });

  const categories = ['General', 'Marketing', 'Inventory', 'Utilities', 'Travel', 'Meals', 'Office Supplies', 'Salary', 'Rent'];
  const pMethods = ['Cash', 'Bank Transfer', 'UPI', 'Credit Card', 'Debit Card'];

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => 
      (exp.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [expenses, searchTerm]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [filteredExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await dbService.add('expenses', {
        description: formData.description,
        amount: parseFloat(formData.amount as string),
        category: formData.category,
        date: new Date(formData.date).toISOString(),
        payment_method: formData.paymentMethod,
      }, { userId: user.uid });
      
      setIsModalOpen(false);
      setFormData({
        description: '',
        amount: '',
        category: 'General',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash'
      });
    } catch (error) {
      console.error("Error adding expense:", error);
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
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
      await dbService.delete('expenses', deletingId, { offlineMode: isOfflineMode, userId: user?.uid || '' });
      setDeletingId(null);
    } catch (error) {
       console.error("Error deleting expense:", error);
       handleFirestoreError(error, OperationType.DELETE, `expenses/${deletingId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight uppercase">Expenses</h1>
          <p className="text-neutral-500 font-bold text-sm mt-1 uppercase tracking-wider">Manage your business spending</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-3 text-neutral-400 hover:text-neutral-900 bg-white border border-neutral-100 rounded-2xl shadow-sm transition-all">
            <Download size={20} />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#000000] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] shadow-xl shadow-neutral-900/10 hover:translate-y-[-2px] transition-all active:scale-95"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#10191F] rounded-[2rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10">
            <DollarSign className="text-green-400" size={32} />
          </div>
          <div>
            <p className="text-[10px] font-black text-green-200 uppercase tracking-widest mb-1">Total Period Expense</p>
            <h2 className="text-4xl font-black tracking-tighter text-white">{formatCurrency(totalExpense, 'INR')}</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl">
          <AlertCircle size={16} className="text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-100">
            Budget status: within limit
          </span>
        </div>
      </motion.div>

      {/* List Container */}
      <div className="glass-card bg-white border border-neutral-100 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative flex-1 max-w-md px-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text" 
              placeholder="SEARCH EXPENSES..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-400 focus:ring-2 focus:ring-black transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-neutral-500 uppercase tracking-widest hover:bg-neutral-50 rounded-xl transition-all">
              <Filter size={14} />
              Sort: Recent
            </button>
          </div>
        </div>

        <div className="overflow-x-auto px-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100">Method</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-neutral-50/50 transition-all group">
                  <td className="px-6 py-5 whitespace-nowrap">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-tight">
                      {format(new Date(exp.date), 'dd MMM yyyy')}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-neutral-100 text-neutral-600">
                        <Receipt size={16} />
                      </div>
                      <span className="text-xs font-black text-neutral-900 uppercase tracking-tight">{exp.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <span className="inline-block px-3 py-1 rounded-full bg-neutral-100 text-[10px] font-black text-neutral-500 uppercase tracking-wider">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                     <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{exp.payment_method}</span>
                  </td>
                  <td className="px-6 py-5 text-right whitespace-nowrap">
                    <span className="text-sm font-black text-neutral-900 tracking-tight">
                      {formatCurrency(exp.amount, 'INR')}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleDelete(exp.id)}
                        className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-xl transition-all"
                        title="Delete Expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 rounded-full bg-neutral-50">
                        <Receipt size={40} className="text-neutral-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-neutral-900 uppercase tracking-tight">No expenses found</p>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Start tracking your business spend today</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-[60]" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[70] p-4"
            >
              <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-neutral-100">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-xl">
                    <Plus className="text-white" size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">Record Expense</h3>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Add a new spending record</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">Description</label>
                    <input 
                      type="text" 
                      required
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="E.G., OFFICE RENT"
                      className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-300 focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">Amount</label>
                      <input 
                        type="number" 
                        required
                        value={formData.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const cleaned = val.replace(/^0+(?=\d)/, '');
                          e.target.value = cleaned;
                          setFormData(prev => ({ ...prev, amount: cleaned }));
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider placeholder:text-neutral-300 focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">Date</label>
                      <input 
                        type="date" 
                        required
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-black"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">Category</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-5 py-4 bg-neutral-50 border-none rounded-2xl text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-black"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">Payment Method</label>
                    <div className="flex flex-wrap gap-2">
                      {pMethods.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, paymentMethod: m }))}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            formData.paymentMethod === m ? "bg-neutral-900 text-white shadow-lg" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-900 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-4 bg-[#000000] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-neutral-900/10 hover:translate-y-[-2px] transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'SAVING...' : 'SAVE RECORD'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
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
              <h2 className="text-2xl font-black mb-2">Delete Expense?</h2>
              <p className="text-neutral-500 mb-8">
                Are you sure you want to delete this expense? This action cannot be undone.
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
