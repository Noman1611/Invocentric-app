/**
 * Universal Financial Data Export Engine (Fintech Standard)
 * Converts business transactions into a strict Double-Entry Accounting Schema.
 * Compatible with Tally Prime, QuickBooks, Zoho Books, SAP, and custom ERP data importers.
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface UniversalAccountingEntry {
  Date: string;           // YYYY-MM-DD
  VoucherType: 'Sales' | 'Purchase' | 'Receipt' | 'Payment' | 'Expense' | 'Journal';
  VoucherNo: string;
  DebitLedger: string;
  CreditLedger: string;
  Amount: number;         // Total Transaction Amount
  CGST: number;           // CGST Tax Component
  SGST: number;           // SGST Tax Component
  IGST: number;           // IGST Tax Component
  Narration: string;      // Detailed standard memo
}

/**
 * Normalizes any timestamp, ISO string or Date into YYYY-MM-DD
 */
export function formatAccountingDate(dateInput: any): string {
  if (!dateInput) return format(new Date(), 'yyyy-MM-dd');
  try {
    if (typeof dateInput === 'string') {
      const parsed = new Date(dateInput);
      if (!isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd');
    }
    if (dateInput?.toDate && typeof dateInput.toDate === 'function') {
      return format(dateInput.toDate(), 'yyyy-MM-dd');
    }
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      return format(dateInput, 'yyyy-MM-dd');
    }
  } catch (e) {}
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Transforms internal records (invoices, purchases, payments, expenses)
 * into strict, flat double-entry accounting records.
 */
export function transformToUniversalDoubleEntry(options: {
  invoices?: any[];
  purchases?: any[];
  payments?: any[];
  expenses?: any[];
  customers?: any[];
  businessName?: string;
  state?: string;
}): UniversalAccountingEntry[] {
  const {
    invoices = [],
    purchases = [],
    payments = [],
    expenses = [],
    customers = [],
    businessName = 'InvoCentric Entity',
    state = ''
  } = options;

  const entries: UniversalAccountingEntry[] = [];

  // 1. Transform Sales Invoices
  invoices.forEach((inv) => {
    const gross = Number(inv.amount || inv.total || 0);
    if (gross <= 0) return;

    const totalTax = Number(inv.tax || inv.total_tax || 0);
    const isInterstate = inv.is_interstate || (inv.place_of_supply && state && inv.place_of_supply !== state);
    
    const cgst = isInterstate ? 0 : Number((totalTax / 2).toFixed(2));
    const sgst = isInterstate ? 0 : Number((totalTax / 2).toFixed(2));
    const igst = isInterstate ? Number(totalTax.toFixed(2)) : 0;

    const custName = (inv.customer_name || inv.customerName || 'Cash Customer').trim();
    const isCashSale = custName.toLowerCase().includes('cash') || (inv.status === 'paid' && !inv.customer_id);
    const debitAccount = isCashSale ? 'Cash-in-Hand' : `Sundry Debtors: ${custName}`;
    const vNo = inv.invoice_number || inv.invoiceNumber || inv.id || 'INV-000';

    const itemsSummary = Array.isArray(inv.items) && inv.items.length > 0
      ? inv.items.map((i: any) => `${i.description || 'Item'} (Qty: ${i.quantity || 1})`).join('; ')
      : 'Supply of goods/services';

    entries.push({
      Date: formatAccountingDate(inv.created_at || inv.createdAt || inv.date),
      VoucherType: 'Sales',
      VoucherNo: String(vNo),
      DebitLedger: debitAccount,
      CreditLedger: 'Sales Account',
      Amount: Number(gross.toFixed(2)),
      CGST: cgst,
      SGST: sgst,
      IGST: igst,
      Narration: `Being sales invoice ${vNo} issued to ${custName} against ${itemsSummary}`
    });
  });

  // 2. Transform Purchase Bills
  purchases.forEach((pur) => {
    const gross = Number(pur.total || pur.amount || 0);
    if (gross <= 0) return;

    const totalTax = Number(pur.tax || 0);
    const cgst = Number((totalTax / 2).toFixed(2));
    const sgst = Number((totalTax / 2).toFixed(2));
    const igst = 0;

    const supplierName = (pur.supplier_name || pur.supplierName || 'General Supplier').trim();
    const vNo = pur.bill_number || pur.billNumber || pur.invoice_number || pur.id || 'BILL-000';

    entries.push({
      Date: formatAccountingDate(pur.date || pur.created_at),
      VoucherType: 'Purchase',
      VoucherNo: String(vNo),
      DebitLedger: 'Purchase Account',
      CreditLedger: `Sundry Creditors: ${supplierName}`,
      Amount: Number(gross.toFixed(2)),
      CGST: cgst,
      SGST: sgst,
      IGST: igst,
      Narration: `Being purchase bill ${vNo} booked from ${supplierName}`
    });
  });

  // 3. Transform Payment Collections (Receipts)
  payments.forEach((pay) => {
    const amt = Number(pay.amount || 0);
    if (amt <= 0) return;

    const custObj = customers.find((c: any) => c.id === pay.customer_id);
    const custName = (pay.customer_name || pay.customerName || custObj?.name || 'Customer').trim();
    const method = (pay.payment_method || pay.paymentMethod || pay.method || 'Cash').toUpperCase();
    const debitBank = method.includes('BANK') || method.includes('UPI') || method.includes('NEFT') || method.includes('CHEQUE')
      ? `Bank Account (${method})`
      : 'Cash-in-Hand';

    const vNo = pay.reference || pay.transaction_id || pay.id || 'REC-000';

    entries.push({
      Date: formatAccountingDate(pay.date || pay.created_at),
      VoucherType: 'Receipt',
      VoucherNo: String(vNo),
      DebitLedger: debitBank,
      CreditLedger: `Sundry Debtors: ${custName}`,
      Amount: Number(amt.toFixed(2)),
      CGST: 0,
      SGST: 0,
      IGST: 0,
      Narration: `Being payment received from ${custName} via ${method} (Ref: ${vNo})`
    });
  });

  // 4. Transform Operational Expenses (Payments)
  expenses.forEach((exp) => {
    const amt = Number(exp.amount || 0);
    if (amt <= 0) return;

    const category = (exp.category || 'General Operations').trim();
    const title = (exp.title || exp.description || 'Business Expense').trim();
    const method = (exp.payment_method || exp.paymentMethod || 'Cash').toUpperCase();
    const creditLedger = method.includes('BANK') || method.includes('UPI') || method.includes('CARD')
      ? `Bank Account (${method})`
      : 'Cash-in-Hand';

    const vNo = exp.id || `EXP-${formatAccountingDate(exp.date || exp.created_at).replace(/-/g, '')}`;

    entries.push({
      Date: formatAccountingDate(exp.date || exp.created_at),
      VoucherType: 'Expense',
      VoucherNo: String(vNo),
      DebitLedger: `Indirect Expense: ${category}`,
      CreditLedger: creditLedger,
      Amount: Number(amt.toFixed(2)),
      CGST: 0,
      SGST: 0,
      IGST: 0,
      Narration: `Being expense paid towards ${title} under ${category}`
    });
  });

  // Sort chronologically by date descending
  return entries.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
}

/**
 * Downloads a flat JSON array for direct API-to-API ERP integrations.
 */
export function exportUniversalJson(entries: UniversalAccountingEntry[], fileName: string = 'universal_financial_data.json') {
  const jsonString = JSON.stringify(entries, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports flat Excel (.xlsx) file with standard accounting column headers.
 */
export function exportUniversalExcel(entries: UniversalAccountingEntry[], fileName: string = 'universal_financial_data.xlsx') {
  const cleanData = entries.map((entry) => ({
    'Date': entry.Date,
    'Voucher Type': entry.VoucherType,
    'Voucher No': entry.VoucherNo,
    'Debit Ledger': entry.DebitLedger,
    'Credit Ledger': entry.CreditLedger,
    'Amount': entry.Amount,
    'CGST': entry.CGST,
    'SGST': entry.SGST,
    'IGST': entry.IGST,
    'Narration': entry.Narration
  }));

  const worksheet = XLSX.utils.json_to_sheet(cleanData);

  // Set optimal column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 14 }, // Voucher Type
    { wch: 18 }, // Voucher No
    { wch: 28 }, // Debit Ledger
    { wch: 28 }, // Credit Ledger
    { wch: 14 }, // Amount
    { wch: 10 }, // CGST
    { wch: 10 }, // SGST
    { wch: 10 }, // IGST
    { wch: 50 }, // Narration
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Double Entry Journal');
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

/**
 * Exports flat CSV (.csv) file suitable for legacy VLOOKUP and custom import scripts.
 */
export function exportUniversalCsv(entries: UniversalAccountingEntry[], fileName: string = 'universal_financial_data.csv') {
  const headers = ['Date', 'Voucher Type', 'Voucher No', 'Debit Ledger', 'Credit Ledger', 'Amount', 'CGST', 'SGST', 'IGST', 'Narration'];
  
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [
    headers.join(','),
    ...entries.map(e => [
      escapeCsv(e.Date),
      escapeCsv(e.VoucherType),
      escapeCsv(e.VoucherNo),
      escapeCsv(e.DebitLedger),
      escapeCsv(e.CreditLedger),
      e.Amount.toFixed(2),
      e.CGST.toFixed(2),
      e.SGST.toFixed(2),
      e.IGST.toFixed(2),
      escapeCsv(e.Narration)
    ].join(','))
  ];

  const csvContent = csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * High-quality fintech dummy data generator for landing page demo
 */
export function generateDemoAccountingData(): UniversalAccountingEntry[] {
  return [
    {
      Date: '2026-09-22',
      VoucherType: 'Sales',
      VoucherNo: 'INV-2026-0891',
      DebitLedger: 'Sundry Debtors: Apex Global Logistics Ltd',
      CreditLedger: 'Sales Account',
      Amount: 48500.00,
      CGST: 4365.00,
      SGST: 4365.00,
      IGST: 0.00,
      Narration: 'Being sales invoice INV-2026-0891 issued to Apex Global Logistics Ltd for Cloud ERP Subscription & Hardware Terminals'
    },
    {
      Date: '2026-09-21',
      VoucherType: 'Receipt',
      VoucherNo: 'REC-UPI-98124',
      DebitLedger: 'Bank Account (UPI)',
      CreditLedger: 'Sundry Debtors: Apex Global Logistics Ltd',
      Amount: 48500.00,
      CGST: 0.00,
      SGST: 0.00,
      IGST: 0.00,
      Narration: 'Being payment received from Apex Global Logistics Ltd via UPI (Ref: REC-UPI-98124)'
    },
    {
      Date: '2026-09-20',
      VoucherType: 'Sales',
      VoucherNo: 'INV-2026-0890',
      DebitLedger: 'Sundry Debtors: Zenith Infotech Solutions',
      CreditLedger: 'Sales Account',
      Amount: 118000.00,
      CGST: 0.00,
      SGST: 0.00,
      IGST: 18000.00,
      Narration: 'Being sales invoice INV-2026-0890 issued to Zenith Infotech Solutions against Interstate Annual Maintenance Contract'
    },
    {
      Date: '2026-09-18',
      VoucherType: 'Purchase',
      VoucherNo: 'PUR-B-1044',
      DebitLedger: 'Purchase Account',
      CreditLedger: 'Sundry Creditors: Om Micro Systems Pvt Ltd',
      Amount: 64900.00,
      CGST: 4950.00,
      SGST: 4950.00,
      IGST: 0.00,
      Narration: 'Being purchase bill PUR-B-1044 booked from Om Micro Systems Pvt Ltd for Thermal Paper Rolls & Barcode Scanners'
    },
    {
      Date: '2026-09-17',
      VoucherType: 'Payment',
      VoucherNo: 'PMT-NEFT-5542',
      DebitLedger: 'Sundry Creditors: Om Micro Systems Pvt Ltd',
      CreditLedger: 'Bank Account (NEFT)',
      Amount: 64900.00,
      CGST: 0.00,
      SGST: 0.00,
      IGST: 0.00,
      Narration: 'Being vendor payout cleared for Om Micro Systems Pvt Ltd via NEFT transfer'
    },
    {
      Date: '2026-09-15',
      VoucherType: 'Expense',
      VoucherNo: 'EXP-20260915',
      DebitLedger: 'Indirect Expense: Office Rent & Utilities',
      CreditLedger: 'Bank Account (NEFT)',
      Amount: 35000.00,
      CGST: 0.00,
      SGST: 0.00,
      IGST: 0.00,
      Narration: 'Being expense paid towards Commercial Office Lease - Sep 2026 under Office Rent & Utilities'
    },
    {
      Date: '2026-09-14',
      VoucherType: 'Sales',
      VoucherNo: 'INV-2026-0889',
      DebitLedger: 'Cash-in-Hand',
      CreditLedger: 'Sales Account',
      Amount: 1450.00,
      CGST: 110.59,
      SGST: 110.59,
      IGST: 0.00,
      Narration: 'Being sales invoice INV-2026-0889 issued to Cash Customer against POS Counter Sale'
    },
    {
      Date: '2026-09-12',
      VoucherType: 'Expense',
      VoucherNo: 'EXP-20260912',
      DebitLedger: 'Indirect Expense: Internet & Cloud Hosting',
      CreditLedger: 'Bank Account (CARD)',
      Amount: 8499.00,
      CGST: 0.00,
      SGST: 0.00,
      IGST: 0.00,
      Narration: 'Being expense paid towards AWS Cloud Infrastructure and Fiber Broadband'
    }
  ];
}
