import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileCode,
  Download,
  Filter,
  Search,
  Copy,
  Check,
  Calendar,
  Layers,
  CheckCircle2,
  Table as TableIcon,
  Code as CodeIcon,
  Building2,
  RefreshCw
} from 'lucide-react';
import {
  UniversalAccountingEntry,
  transformToUniversalDoubleEntry,
  generateDemoAccountingData,
  exportUniversalExcel,
  exportUniversalCsv,
  exportUniversalJson,
  formatAccountingDate
} from '../services/accountingExportEngine';
import { formatCurrency, cn } from '../lib/utils';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export interface UniversalAccountingExportDashboardProps {
  useDemoData?: boolean;
  invoices?: any[];
  purchases?: any[];
  payments?: any[];
  expenses?: any[];
  customers?: any[];
  businessName?: string;
  state?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function UniversalAccountingExportDashboard({
  useDemoData = false,
  invoices,
  purchases,
  payments,
  expenses,
  customers,
  businessName = 'My Business',
  state = '',
  title = 'Universal Accounting Export & Integration Center',
  subtitle = 'Strict Double-Entry Schema ready for Tally, QuickBooks, Zoho, SAP, and custom ERPs',
  className = ''
}: UniversalAccountingExportDashboardProps) {
  // View mode switcher: 'table' vs 'json'
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_month' | 'quarter' | 'fy'>('all');
  const [voucherFilter, setVoucherFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  // Transform raw data or generate demo data
  const rawEntries = useMemo<UniversalAccountingEntry[]>(() => {
    if (useDemoData || (!invoices && !purchases && !payments && !expenses)) {
      return generateDemoAccountingData();
    }
    return transformToUniversalDoubleEntry({
      invoices,
      purchases,
      payments,
      expenses,
      customers,
      businessName,
      state
    });
  }, [useDemoData, invoices, purchases, payments, expenses, customers, businessName, state]);

  // Apply Date and Search Filters
  const filteredEntries = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (dateFilter === 'this_month') {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    } else if (dateFilter === 'last_month') {
      const prev = subMonths(now, 1);
      startDate = startOfMonth(prev);
      endDate = endOfMonth(prev);
    } else if (dateFilter === 'quarter') {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3;
      startDate = new Date(now.getFullYear(), qStartMonth, 1);
      endDate = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
    } else if (dateFilter === 'fy') {
      const yr = now.getFullYear();
      const isPostMarch = now.getMonth() >= 3;
      const fyStartYear = isPostMarch ? yr : yr - 1;
      startDate = new Date(fyStartYear, 3, 1);
      endDate = new Date(fyStartYear + 1, 2, 31, 23, 59, 59);
    }

    return rawEntries.filter((entry) => {
      // Date filter
      if (startDate && endDate) {
        const eDate = new Date(entry.Date);
        if (eDate < startDate || eDate > endDate) return false;
      }

      // Voucher Type filter
      if (voucherFilter !== 'all' && entry.VoucherType.toLowerCase() !== voucherFilter.toLowerCase()) {
        return false;
      }

      // Text Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesVoucher = entry.VoucherNo.toLowerCase().includes(term);
        const matchesDebit = entry.DebitLedger.toLowerCase().includes(term);
        const matchesCredit = entry.CreditLedger.toLowerCase().includes(term);
        const matchesNarration = entry.Narration.toLowerCase().includes(term);
        if (!matchesVoucher && !matchesDebit && !matchesCredit && !matchesNarration) {
          return false;
        }
      }

      return true;
    });
  }, [rawEntries, dateFilter, voucherFilter, searchTerm]);

  // Compute Aggregates
  const aggregates = useMemo(() => {
    let totalDebitCredit = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    filteredEntries.forEach((e) => {
      totalDebitCredit += e.Amount;
      totalCgst += e.CGST;
      totalSgst += e.SGST;
      totalIgst += e.IGST;
    });

    return {
      count: filteredEntries.length,
      totalVolume: totalDebitCredit,
      totalTax: totalCgst + totalSgst + totalIgst,
      totalCgst,
      totalSgst,
      totalIgst
    };
  }, [filteredEntries]);

  // Action Handlers
  const handleDownloadExcel = () => {
    const cleanBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Universal_Double_Entry_${cleanBiz}_${dateFilter}_${format(new Date(), 'yyyyMMdd')}`;
    exportUniversalExcel(filteredEntries, fileName);
    setDownloadNotice('Universal Excel (.xlsx) file downloaded successfully!');
    setTimeout(() => setDownloadNotice(null), 4000);
  };

  const handleDownloadCsv = () => {
    const cleanBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Universal_Double_Entry_${cleanBiz}_${dateFilter}_${format(new Date(), 'yyyyMMdd')}`;
    exportUniversalCsv(filteredEntries, fileName);
    setDownloadNotice('Universal CSV (.csv) file downloaded successfully!');
    setTimeout(() => setDownloadNotice(null), 4000);
  };

  const handleDownloadJson = () => {
    const cleanBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `universal_accounting_integration_${cleanBiz}_${dateFilter}.json`;
    exportUniversalJson(filteredEntries, fileName);
    setDownloadNotice('Integration JSON (.json) file downloaded successfully!');
    setTimeout(() => setDownloadNotice(null), 4000);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filteredEntries, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (e) {}
  };

  return (
    <div className={cn("card-base p-4 sm:p-6 space-y-6 text-slate-900 bg-white", className)}>
      
      {/* Header & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge bg-green-100 text-green-800 border border-green-200">
              Universal ERP Engine
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Tally · QuickBooks · Zoho · SAP
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Side-by-Side Action Center */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadExcel}
            className="btn-primary flex items-center gap-1.5 text-xs font-bold shadow-sm cursor-pointer"
            title="Download Universal Excel Sheet (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>Download Universal Excel</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="btn-secondary flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Download Universal CSV Flat File (.csv)"
          >
            <Download size={14} />
            <span>CSV</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="btn-secondary flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Download Integration JSON Array (.json)"
          >
            <FileCode size={14} className="text-green-700" />
            <span>Download Integration JSON</span>
          </button>
        </div>
      </div>

      {/* Success Download Notice */}
      {downloadNotice && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Live Filtering Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
        
        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Calendar size={13} />
            Period:
          </span>
          {[
            { id: 'all', label: 'All Records' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'quarter', label: 'Quarter' },
            { id: 'fy', label: 'Full FY' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer",
                dateFilter === tab.id
                  ? "bg-green-700 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Voucher Type Dropdown & Text Search */}
        <div className="flex items-center gap-2 flex-1 lg:max-w-md justify-end">
          <div className="shrink-0">
            <select
              value={voucherFilter}
              onChange={(e) => setVoucherFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-green-600 cursor-pointer"
            >
              <option value="all">All Vouchers</option>
              <option value="sales">Sales Only</option>
              <option value="purchase">Purchases Only</option>
              <option value="receipt">Receipts Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>

          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher, ledger or memo..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-green-600"
            />
          </div>
        </div>
      </div>

      {/* Aggregate KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Entries</span>
          <span className="text-base font-black text-slate-900">{aggregates.count}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Balanced Vouchers</span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Transaction Value</span>
          <span className="text-base font-black text-slate-900">{formatCurrency(aggregates.totalVolume, 'INR')}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Debit / Credit Equilibrium</span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">CGST + SGST</span>
          <span className="text-base font-black text-green-700">
            {formatCurrency(aggregates.totalCgst + aggregates.totalSgst, 'INR')}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Intra-State GST</span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">IGST Component</span>
          <span className="text-base font-black text-blue-700">
            {formatCurrency(aggregates.totalIgst, 'INR')}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Inter-State GST</span>
        </div>
      </div>

      {/* Preview Section Header with Format Switcher Toggle */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
            Live Export Preview
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            ({filteredEntries.length} {filteredEntries.length === 1 ? 'row' : 'rows'})
          </span>
        </div>

        {/* View Mode Toggle Button Group */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === 'table'
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <TableIcon size={13} />
            <span>Table Grid</span>
          </button>

          <button
            onClick={() => setViewMode('json')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === 'json'
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <CodeIcon size={13} />
            <span>JSON Code</span>
          </button>
        </div>
      </div>

      {/* Preview Screen Body */}
      {viewMode === 'table' ? (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 border-r border-slate-200">Date</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Type</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Voucher No</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Debit Ledger</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Credit Ledger</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right">CGST</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right">SGST</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right">IGST</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                      No accounting entries found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((row, idx) => (
                    <tr key={`${row.VoucherNo}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60 hover:bg-slate-100/50"}>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap">
                        {row.Date}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          row.VoucherType === 'Sales' && "bg-green-100 text-green-800",
                          row.VoucherType === 'Purchase' && "bg-blue-100 text-blue-800",
                          row.VoucherType === 'Receipt' && "bg-teal-100 text-teal-800",
                          row.VoucherType === 'Expense' && "bg-amber-100 text-amber-800",
                          row.VoucherType === 'Payment' && "bg-rose-100 text-rose-800"
                        )}>
                          {row.VoucherType}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] font-bold text-slate-900 whitespace-nowrap">
                        {row.VoucherNo}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-800">
                        {row.DebitLedger}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-800">
                        {row.CreditLedger}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-900 tabular-nums">
                        {row.Amount.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-600 tabular-nums">
                        {row.CGST > 0 ? row.CGST.toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-600 tabular-nums">
                        {row.SGST > 0 ? row.SGST.toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-600 tabular-nums">
                        {row.IGST > 0 ? row.IGST.toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-xs" title={row.Narration}>
                        {row.Narration}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Formatted JSON Code View */
        <div className="relative border border-slate-800 rounded-2xl bg-slate-950 p-4 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <span className="text-[11px] font-mono text-slate-400">
              // Schema: UniversalDoubleEntryArray[{filteredEntries.length}]
            </span>
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              {isCopied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              <span>{isCopied ? 'Copied JSON!' : 'Copy JSON'}</span>
            </button>
          </div>

          <pre className="font-mono text-xs text-green-400 overflow-x-auto max-h-[440px] leading-relaxed select-all">
            {JSON.stringify(filteredEntries, null, 2)}
          </pre>
        </div>
      )}

      {/* Integration Compatibility Footnote */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
        <span>
          <strong>Double-Entry Guaranteed:</strong> Every row is self-contained with Debit & Credit ledger mappings and narration.
        </span>
        <span className="font-semibold text-green-800">
          Compatible with Tally XML/Excel, QuickBooks IIF/CSV, Zoho Books & SAP B1
        </span>
      </div>
    </div>
  );
}
