import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  RotateCcw, 
  X, 
  Search, 
  FileText, 
  Users, 
  Package, 
  Wallet, 
  Receipt, 
  Calendar, 
  AlertTriangle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { useRecycleBin } from '../hooks/useData';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RecycleBinModal({ isOpen, onClose }: RecycleBinModalProps) {
  const { user, isOfflineMode } = useAuth();
  const { recycleBinItems, loading } = useRecycleBin();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredItems = useMemo(() => {
    return recycleBinItems.filter((item) => {
      const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.original_collection?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.original_collection === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [recycleBinItems, searchTerm, selectedCategory]);

  const handleRestore = async (id: string, title: string) => {
    if (!user) return;
    setActionLoadingId(id);
    try {
      await dbService.restore(id, { offlineMode: isOfflineMode, userId: user.uid });
      showToast(`Restored: ${title}`);
    } catch (error) {
      console.error('Failed to restore item:', error);
      showToast('Error restoring item.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePermanentDelete = async (id: string, title: string) => {
    if (!user) return;
    if (!window.confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
    setActionLoadingId(id);
    try {
      await dbService.delete('recycle_bin', id, { permanent: true, offlineMode: isOfflineMode, userId: user.uid });
      showToast('Item deleted permanently.');
    } catch (error) {
      console.error('Failed to delete item permanently:', error);
      showToast('Error deleting item.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    setActionLoadingId('clear_all');
    try {
      await dbService.emptyRecycleBin({ offlineMode: isOfflineMode, userId: user.uid });
      showToast('Recycle Bin emptied successfully.');
      setShowConfirmClear(false);
    } catch (error) {
      console.error('Failed to empty recycle bin:', error);
      showToast('Error emptying Recycle Bin.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getItemIcon = (category: string) => {
    switch (category) {
      case 'invoices':
        return <FileText className="w-5 h-5 text-green-600" />;
      case 'customers':
        return <Users className="w-5 h-5 text-emerald-600" />;
      case 'items':
        return <Package className="w-5 h-5 text-amber-600" />;
      case 'expenses':
        return <Wallet className="w-5 h-5 text-rose-600" />;
      case 'purchases':
        return <Receipt className="w-5 h-5 text-purple-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-xl text-green-600 border border-green-100 shadow-xs">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">Recycle Bin</h2>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-green-50 text-green-700 border border-green-200/80">
                    {recycleBinItems.length} {recycleBinItems.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Items are kept for 30 days before automatic permanent deletion. Restoring recovers all accounting entries.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {recycleBinItems.length > 0 && (
                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Empty Bin
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {toastMessage}
            </motion.div>
          )}

          {/* Controls: Search & Category Filter */}
          <div className="p-6 pb-2 space-y-3 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title, number, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'invoices', label: 'Invoices' },
                { id: 'customers', label: 'Customers' },
                { id: 'items', label: 'Products' },
                { id: 'expenses', label: 'Expenses' },
                { id: 'purchases', label: 'Purchases' },
                { id: 'payments', label: 'Payments' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body: Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm">Loading deleted items...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  {searchTerm || selectedCategory !== 'all' ? 'No matching items found' : 'Recycle Bin is empty'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  {searchTerm || selectedCategory !== 'all'
                    ? 'Try clearing search filters or selecting a different category.'
                    : 'Any invoices, products, clients, or payments you delete will be safely kept here for 30 days.'}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const deletedDate = item.deleted_at ? new Date(item.deleted_at) : new Date();
                const daysPassed = differenceInDays(new Date(), deletedDate);
                const daysLeft = Math.max(0, 30 - daysPassed);

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs mt-0.5">
                        {getItemIcon(item.original_collection)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="capitalize font-medium px-2 py-0.5 bg-slate-200/60 rounded-md text-slate-700">
                            {item.original_collection}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Deleted {format(deletedDate, 'MMM d, yyyy')}
                          </span>
                          <span className={`font-medium ${daysLeft <= 5 ? 'text-rose-500' : 'text-amber-600'}`}>
                            {daysLeft} days left
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleRestore(item.id, item.title)}
                        disabled={actionLoadingId === item.id}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${actionLoadingId === item.id ? 'animate-spin' : ''}`} />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(item.id, item.title)}
                        disabled={actionLoadingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Modal Footer / Clear Confirmation */}
          {showConfirmClear && (
            <div className="p-4 bg-rose-50 border-t border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                Are you sure you want to permanently clear all {recycleBinItems.length} items? This action CANNOT be undone.
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={actionLoadingId === 'clear_all'}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {actionLoadingId === 'clear_all' ? 'Clearing...' : 'Yes, Empty All'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
