import React from 'react';
import { UniversalAccountingExportDashboard } from '../components/UniversalAccountingExportDashboard';
import { useInvoices, usePurchases, usePayments, useExpenses, useCustomers, useSettings } from '../hooks/useData';
import { ArrowLeft, BookOpen, Sparkles, Building2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function AccountingExportPage() {
  const navigate = useNavigate();
  const { invoices = [] } = useInvoices();
  const { purchases = [] } = usePurchases();
  const { payments = [] } = usePayments();
  const { expenses = [] } = useExpenses();
  const { customers = [] } = useCustomers();
  const { settings } = useSettings();

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-3 sm:px-6 py-4">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition shadow-xs cursor-pointer"
            title="Back to Reports"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Universal Accounting Export & ERP Bridge
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Seamlessly export ledger data for Tally Prime, QuickBooks, Zoho Books, SAP, and custom APIs
            </p>
          </div>
        </div>

        <Link
          to="/reports"
          className="btn-secondary text-xs font-bold hidden sm:inline-flex items-center gap-1.5"
        >
          <Building2 size={14} />
          <span>CA & Tax Hub</span>
        </Link>
      </div>

      {/* Main Universal Accounting Export Dashboard Component */}
      <UniversalAccountingExportDashboard
        useDemoData={invoices.length === 0 && purchases.length === 0}
        invoices={invoices}
        purchases={purchases}
        payments={payments}
        expenses={expenses}
        customers={customers}
        businessName={settings?.business_name || 'My Business'}
        state={settings?.state || ''}
      />
    </div>
  );
}
