import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Keyboard, 
  X, 
  Search, 
  Plus, 
  FileText, 
  ShoppingCart, 
  Package, 
  Users, 
  CreditCard, 
  Printer, 
  Save, 
  ArrowRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface ShortcutItem {
  key: string;
  displayKey: string;
  description: string;
  category: 'Navigation' | 'Vouchers & Billing' | 'Actions' | 'Tools';
  action: () => void;
  global?: boolean;
}

export function GlobalShortcutsManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  }, []);

  const shortcuts: ShortcutItem[] = [
    // --- Vouchers & Billing ---
    {
      key: 'N',
      displayKey: 'N / Alt + N / F8',
      description: 'Create New Sales Invoice / GST Bill',
      category: 'Vouchers & Billing',
      action: () => { navigate('/invoices/create'); showToast('Opened: Create Invoice (N / F8)'); }
    },
    {
      key: 'P',
      displayKey: 'P / Alt + P / F9',
      description: 'Open Purchases Entry (Purchase Voucher)',
      category: 'Vouchers & Billing',
      action: () => { navigate('/purchases'); showToast('Opened: Purchases (P / F9)'); }
    },
    {
      key: 'K',
      displayKey: 'K / Alt + K / F6',
      description: 'Quick Retail POS Counter / Cash Memo',
      category: 'Vouchers & Billing',
      action: () => { navigate('/pos'); showToast('Opened: Quick POS Counter (K / F6)'); }
    },
    {
      key: 'M',
      displayKey: 'M / Alt + M / F5',
      description: 'Payments Ledger (Payment Voucher)',
      category: 'Vouchers & Billing',
      action: () => { navigate('/payments'); showToast('Opened: Payments (M / F5)'); }
    },
    {
      key: 'E',
      displayKey: 'E / Alt + E / F7',
      description: 'Expenses Book (Expense Voucher)',
      category: 'Vouchers & Billing',
      action: () => { navigate('/expenses'); showToast('Opened: Expenses Book (E / F7)'); }
    },
    {
      key: 'B',
      displayKey: 'B / Alt + B / F4',
      description: 'Daily Cash & Bank Book (Contra Ledger)',
      category: 'Vouchers & Billing',
      action: () => { navigate('/dailybook'); showToast('Opened: Daily Cash Book (B / F4)'); }
    },

    // --- Master Navigation ---
    {
      key: 'D',
      displayKey: 'D / Alt + D',
      description: 'Go to Dashboard (Main Business Overview)',
      category: 'Navigation',
      action: () => { navigate('/dashboard'); showToast('Opened: Dashboard (D)'); }
    },
    {
      key: 'I',
      displayKey: 'I / Alt + I',
      description: 'Open Invoices List & Register',
      category: 'Navigation',
      action: () => { navigate('/invoices'); showToast('Opened: Invoices Register (I)'); }
    },
    {
      key: 'C',
      displayKey: 'C / Alt + C',
      description: 'Open Customers & Parties Ledger',
      category: 'Navigation',
      action: () => { navigate('/customers'); showToast('Opened: Customers / Parties (C)'); }
    },
    {
      key: 'T',
      displayKey: 'T / Alt + T',
      description: 'Open Items & Products Inventory Master',
      category: 'Navigation',
      action: () => { navigate('/items'); showToast('Opened: Items & Stock (T)'); }
    },
    {
      key: 'Q',
      displayKey: 'Q / Alt + Q',
      description: 'Open Quotations & Estimates',
      category: 'Navigation',
      action: () => { navigate('/quotations'); showToast('Opened: Quotations (Q)'); }
    },
    {
      key: 'R',
      displayKey: 'R / Alt + R',
      description: 'Open Financial Reports & Tax Summary',
      category: 'Navigation',
      action: () => { navigate('/reports'); showToast('Opened: Reports (R)'); }
    },
    {
      key: 'S',
      displayKey: 'S / Alt + S',
      description: 'Open Settings & Business Configuration',
      category: 'Navigation',
      action: () => { navigate('/settings'); showToast('Opened: Settings (S)'); }
    },
    {
      key: 'G',
      displayKey: 'G / Alt + G',
      description: 'Open Barcode Studio & Label Generator',
      category: 'Tools',
      action: () => { navigate('/barcode-generator'); showToast('Opened: Barcode Studio (G)'); }
    },

    // --- Actions & Helpers ---
    {
      key: 'Ctrl+A',
      displayKey: 'Ctrl + A / Ctrl + S',
      description: 'Save / Accept current Bill or Voucher',
      category: 'Actions',
      action: () => {
        const saveBtn = document.querySelector('button[type="submit"], button#save-and-print-btn, button.btn-primary') as HTMLButtonElement | null;
        if (saveBtn) {
          saveBtn.click();
          showToast('Saved / Accepted (Ctrl + A)');
        }
      }
    },
    {
      key: 'Ctrl+S',
      displayKey: 'Ctrl + S',
      description: 'Quick Save Bill & Generate Invoice',
      category: 'Actions',
      action: () => {
        const saveBtn = document.querySelector('button[type="submit"], button#save-and-print-btn, button.btn-primary') as HTMLButtonElement | null;
        if (saveBtn) {
          saveBtn.click();
          showToast('Invoice Saved (Ctrl + S)');
        }
      }
    },
    {
      key: 'Ctrl+Enter',
      displayKey: 'Ctrl + Enter',
      description: 'Save & Instant Print Invoice',
      category: 'Actions',
      action: () => {
        const printBtn = document.querySelector('button#save-and-print-btn, button.btn-primary') as HTMLButtonElement | null;
        if (printBtn) {
          printBtn.click();
          showToast('Save & Print Triggered (Ctrl + Enter)');
        }
      }
    },
    {
      key: 'Ctrl+P',
      displayKey: 'Ctrl + P',
      description: 'Print active Invoice / POS Receipt / Statement',
      category: 'Actions',
      action: () => {
        window.print();
        showToast('Printing Document (Ctrl + P)');
      }
    },
    {
      key: 'Escape',
      displayKey: 'Esc',
      description: 'Close Modal / Cancel / Go Back to Previous Screen',
      category: 'Actions',
      action: () => {
        if (isOpen) {
          setIsOpen(false);
          return;
        }
        // If inside create/edit page, go back to invoices
        if (location.pathname.includes('/create') || location.pathname.includes('/new') || location.pathname.includes('/edit')) {
          navigate(-1);
          showToast('Returned to previous screen (Esc)');
          return;
        }
        // Blur active element
        if (document.activeElement && 'blur' in document.activeElement) {
          (document.activeElement as HTMLElement).blur();
        }
      }
    },
    {
      key: 'F1',
      displayKey: 'F1 / ?',
      description: 'Open Full Keyboard Navigation Guide',
      category: 'Tools',
      action: () => {
        setIsOpen(prev => !prev);
      }
    }
  ];

  // Global Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl ? ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable : false;

      // Escape to close shortcut modal or cancel/go back
      if (e.key === 'Escape') {
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
          return;
        }
        // If an open modal exists in DOM, let modal close or blur
        const modalCloseBtn = document.querySelector('[data-modal-close="true"], button[aria-label="Close"]') as HTMLButtonElement | null;
        if (modalCloseBtn) {
          e.preventDefault();
          modalCloseBtn.click();
          return;
        }
        if (isInput) {
          activeEl?.blur();
          return;
        }
        if (location.pathname.includes('/create') || location.pathname.includes('/new') || location.pathname.includes('/edit')) {
          e.preventDefault();
          navigate(-1);
          return;
        }
      }

      // Allow pressing '?' (Shift + /) or 'F1' to toggle shortcut guide (when not typing in an input)
      if ((e.key === '?' && !isInput) || e.key === 'F1') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        return;
      }

      // Check Function keys (F4, F5, F6, F7, F8, F9) - work anytime
      const fKeyMap: Record<string, string> = {
        'F4': '/dailybook',
        'F5': '/payments',
        'F6': '/pos',
        'F7': '/expenses',
        'F8': '/invoices/create',
        'F9': '/purchases'
      };
      if (fKeyMap[e.key]) {
        e.preventDefault();
        navigate(fKeyMap[e.key]);
        showToast(`Opened ${fKeyMap[e.key].replace('/', '')} (${e.key})`);
        return;
      }

      // Check Alt + Key combinations - work from ANYWHERE (even when typing in an input)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toUpperCase();
        const altNavMap: Record<string, { path: string; label: string }> = {
          'D': { path: '/dashboard', label: 'Dashboard' },
          'I': { path: '/invoices', label: 'Invoices' },
          'N': { path: '/invoices/create', label: 'Create Invoice' },
          'P': { path: '/purchases', label: 'Purchases' },
          'C': { path: '/customers', label: 'Customers' },
          'T': { path: '/items', label: 'Items & Inventory' },
          'Q': { path: '/quotations', label: 'Quotations' },
          'M': { path: '/payments', label: 'Payments' },
          'B': { path: '/dailybook', label: 'Daily Book' },
          'E': { path: '/expenses', label: 'Expenses' },
          'R': { path: '/reports', label: 'Reports' },
          'S': { path: '/settings', label: 'Settings' },
          'K': { path: '/pos', label: 'Quick POS' },
          'G': { path: '/barcode-generator', label: 'Barcode Studio' }
        };

        if (altNavMap[k]) {
          e.preventDefault();
          navigate(altNavMap[k].path);
          showToast(`Opened: ${altNavMap[k].label} (Alt + ${k})`);
          return;
        }
      }

      // Check Ctrl+A or Ctrl+S (Accept/Save)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A' || e.key === 's' || e.key === 'S')) {
        const saveBtn = document.querySelector('button[type="submit"], button#save-and-print-btn, button.btn-primary') as HTMLButtonElement | null;
        if (saveBtn) {
          e.preventDefault();
          saveBtn.click();
          showToast('Saving current form...');
          return;
        }
      }

      // Check Ctrl+Enter (Save & Print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const printBtn = document.querySelector('button#save-and-print-btn, button.btn-primary') as HTMLButtonElement | null;
        if (printBtn) {
          e.preventDefault();
          printBtn.click();
          showToast('Saving & Printing Invoice...');
          return;
        }
      }

      // Single-Key Navigation (when NOT typing inside any input, textarea or select)
      if (!isInput && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const singleKey = e.key.toUpperCase();
        const singleKeyMap: Record<string, { path: string; label: string }> = {
          'D': { path: '/dashboard', label: 'Dashboard' },
          'I': { path: '/invoices', label: 'Invoices' },
          'N': { path: '/invoices/create', label: 'Create Invoice' },
          'P': { path: '/purchases', label: 'Purchases' },
          'C': { path: '/customers', label: 'Customers / Parties' },
          'T': { path: '/items', label: 'Items & Products' },
          'Q': { path: '/quotations', label: 'Quotations' },
          'M': { path: '/payments', label: 'Payments' },
          'B': { path: '/dailybook', label: 'Daily Book' },
          'E': { path: '/expenses', label: 'Expenses' },
          'R': { path: '/reports', label: 'Reports' },
          'S': { path: '/settings', label: 'Settings' },
          'K': { path: '/pos', label: 'Quick POS' },
          'G': { path: '/barcode-generator', label: 'Barcode Studio' }
        };

        if (singleKeyMap[singleKey]) {
          e.preventDefault();
          navigate(singleKeyMap[singleKey].path);
          showToast(`⚡ ${singleKeyMap[singleKey].label} (${singleKey})`);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, navigate, location, showToast]);

  const categories = ['All', 'Vouchers & Billing', 'Navigation', 'Actions', 'Tools'];

  const filteredShortcuts = shortcuts.filter(s => {
    const matchesCat = activeCategory === 'All' || s.category === activeCategory;
    const matchesSearch = s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.displayKey.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  useEffect(() => {
    const handleOpenModal = () => setIsOpen(true);
    window.addEventListener('open_shortcuts_modal', handleOpenModal);
    return () => window.removeEventListener('open_shortcuts_modal', handleOpenModal);
  }, []);

  return (
    <>
      {/* Interactive Toast Notification for executed shortcuts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-slate-950 text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 text-xs font-bold tracking-wide pointer-events-none"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Zap size={14} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Shortcuts Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 print:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Keyboard size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span>Pro Business Shortcut Keys</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] uppercase font-mono tracking-wider">Fast Workflow</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Operate the entire application seamlessly from the keyboard without touching the mouse</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search & Category Tabs */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search shortcut (e.g. Invoices, F8, Purchases, POS, Esc)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        activeCategory === cat
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shortcuts Grid List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredShortcuts.length > 0 ? (
                  filteredShortcuts.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setIsOpen(false);
                        s.action();
                      }}
                      className="p-3 bg-white hover:bg-emerald-50/60 border border-slate-100 hover:border-emerald-200 rounded-2xl flex items-center justify-between gap-4 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-24 shrink-0 text-center">
                          <kbd className="px-2.5 py-1.5 bg-slate-100 group-hover:bg-emerald-100 text-slate-800 group-hover:text-emerald-800 font-mono text-xs font-black rounded-lg border border-slate-200 group-hover:border-emerald-300 shadow-2xs">
                            {s.displayKey}
                          </kbd>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-950">
                            {s.description}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            {s.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-emerald-700 text-xs font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Execute</span>
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs font-medium">
                    No matching shortcut found for "{searchQuery}".
                  </div>
                )}
              </div>

              {/* Footer Tip */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">F1</kbd>
                  <span>or</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">?</kbd>
                  <span>opens this guide | Press underlined letters or Alt+Key to navigate</span>
                </span>
                <span className="font-bold text-slate-700">Keyboard-Only Workflow</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
