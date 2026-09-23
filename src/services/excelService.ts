import * as XLSX from 'xlsx';

export function exportToExcel(data: any[], fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportInvoicesAsMultiSheet(invoices: any[], fileName: string) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet for all invoices
  const summaryData = formatInvoicesForExcel(invoices);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'All Invoices');

  // Individual sheets for each invoice
  invoices.forEach((inv) => {
    const mainInfo = [
      { 'Field': 'Invoice ID', 'Value': inv.id.toUpperCase() },
      { 'Field': 'Date', 'Value': inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString() : 'N/A' },
      { 'Field': 'Due Date', 'Value': inv.dueDate?.toDate ? inv.dueDate.toDate().toLocaleDateString() : 'N/A' },
      { 'Field': 'Customer', 'Value': inv.customerName || 'N/A' },
      { 'Field': 'Status', 'Value': inv.status.toUpperCase() },
      { 'Field': 'Currency', 'Value': inv.currency },
      { 'Field': 'Subtotal', 'Value': inv.subtotal || 0 },
      { 'Field': 'Tax', 'Value': inv.tax || 0 },
      { 'Field': 'Total Amount', 'Value': inv.amount },
      { 'Field': '', 'Value': '' }, // Spacer
      { 'Field': 'ITEMS', 'Value': '---' }
    ];

    const itemsData = (inv.items || []).map((item: any) => ({
      'Description': item.description,
      'Quantity': item.quantity,
      'Price': item.price,
      'Total': item.quantity * item.price
    }));

    // Combine main info and items
    // First, convert the mainInfo objects to arrays/rows or just json_to_sheet
    const ws = XLSX.utils.json_to_sheet(mainInfo);
    
    // Append items starting after mainInfo
    XLSX.utils.sheet_add_json(ws, itemsData, { origin: 'A14' });

    // Use truncated ID for sheet name (max 31 chars)
    const sheetName = `Invoice ${inv.id.slice(0, 8)}`;
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function formatInvoicesForExcel(invoices: any[]) {
  return invoices.map(inv => ({
    'Invoice ID': inv.id.toUpperCase(),
    'Date': inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString() : 'N/A',
    'Customer': inv.customerName || 'N/A',
    'Total Amount': inv.amount,
    'Subtotal': inv.subtotal || 0,
    'Tax': inv.tax || 0,
    'Currency': inv.currency,
    'Status': inv.status.toUpperCase(),
    'Due Date': inv.dueDate?.toDate ? inv.dueDate.toDate().toLocaleDateString() : 'N/A',
    'Items': (inv.items || []).map((item: any) => `${item.description} (x${item.quantity})`).join(', ')
  }));
}

export interface CaExportOptions {
  invoices: any[];
  purchases?: any[];
  expenses?: any[];
  customers?: any[];
  payments?: any[];
  businessProfile?: any;
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Complete CA (Chartered Accountant) Multi-Sheet Data Package
 * Generates an audit-ready multi-tab Excel workbook:
 * 1. GST & Tax Summary (Outward vs Inward Supplies, Net Tax Liability)
 * 2. GSTR-1 Sales Register (Invoice-wise details with GST rates & values)
 * 3. GSTR-2B Purchases Register (Supplier Bills, ITC details)
 * 4. Expense Register (Operating expenses, categories)
 * 5. Debtors Ledger (Customer balances & receivables)
 */
export function exportCompleteCaPackage(options: CaExportOptions): string {
  const {
    invoices = [],
    purchases = [],
    expenses = [],
    customers = [],
    payments = [],
    businessProfile = {},
    periodLabel = 'All Time'
  } = options;

  const workbook = XLSX.utils.book_new();

  // 1. Calculate Aggregates for Sheet 1 (Tax Summary)
  let totalSalesTaxable = 0;
  let totalSalesCgst = 0;
  let totalSalesSgst = 0;
  let totalSalesIgst = 0;
  let totalSalesGross = 0;

  invoices.forEach(inv => {
    const gross = Number(inv.amount || inv.total || 0);
    const tax = Number(inv.tax || inv.total_tax || 0);
    const taxable = Number(inv.subtotal || (gross - tax) || 0);
    
    // Check IGST vs CGST/SGST based on state
    const isInterstate = inv.is_interstate || (inv.place_of_supply && businessProfile.state && inv.place_of_supply !== businessProfile.state);
    
    totalSalesGross += gross;
    totalSalesTaxable += taxable;

    if (isInterstate) {
      totalSalesIgst += tax;
    } else {
      totalSalesCgst += tax / 2;
      totalSalesSgst += tax / 2;
    }
  });

  let totalPurchasesTaxable = 0;
  let totalPurchasesCgst = 0;
  let totalPurchasesSgst = 0;
  let totalPurchasesIgst = 0;
  let totalPurchasesGross = 0;

  purchases.forEach(pur => {
    const gross = Number(pur.total || pur.amount || 0);
    const tax = Number(pur.tax || 0);
    const taxable = Number(pur.subtotal || (gross - tax) || 0);
    
    totalPurchasesGross += gross;
    totalPurchasesTaxable += taxable;
    totalPurchasesCgst += tax / 2;
    totalPurchasesSgst += tax / 2;
  });

  const totalOutputGst = totalSalesCgst + totalSalesSgst + totalSalesIgst;
  const totalInputGst = totalPurchasesCgst + totalPurchasesSgst + totalPurchasesIgst;
  const netGstPayable = Math.max(0, totalOutputGst - totalInputGst);
  const itcBalance = Math.max(0, totalInputGst - totalOutputGst);

  let totalExpenses = 0;
  expenses.forEach(exp => {
    totalExpenses += Number(exp.amount || 0);
  });

  // Sheet 1: GST & Financial Summary
  const summaryRows = [
    { 'CA AUDIT & TAX RETURN REPORT': 'INVOCENTRIC BUSINESS SUMMARY', 'DETAILS': '' },
    { 'CA AUDIT & TAX RETURN REPORT': 'Business Name', 'DETAILS': businessProfile.businessName || businessProfile.name || 'My Business' },
    { 'CA AUDIT & TAX RETURN REPORT': 'GSTIN', 'DETAILS': businessProfile.gstin || 'Unregistered / Not Set' },
    { 'CA AUDIT & TAX RETURN REPORT': 'Phone', 'DETAILS': businessProfile.phone || 'N/A' },
    { 'CA AUDIT & TAX RETURN REPORT': 'Email', 'DETAILS': businessProfile.email || 'N/A' },
    { 'CA AUDIT & TAX RETURN REPORT': 'Audit Period', 'DETAILS': periodLabel },
    { 'CA AUDIT & TAX RETURN REPORT': 'Report Generated On', 'DETAILS': new Date().toLocaleString() },
    { 'CA AUDIT & TAX RETURN REPORT': '', 'DETAILS': '' },
    { 'CA AUDIT & TAX RETURN REPORT': '--- OUTWARD SUPPLIES (SALES / GSTR-1) ---', 'DETAILS': '' },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Sales Invoices Count', 'DETAILS': invoices.length },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Taxable Turnover (Rs.)', 'DETAILS': totalSalesTaxable.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Output CGST (Rs.)', 'DETAILS': totalSalesCgst.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Output SGST (Rs.)', 'DETAILS': totalSalesSgst.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Output IGST (Rs.)', 'DETAILS': totalSalesIgst.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Output GST (Rs.)', 'DETAILS': totalOutputGst.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Gross Sales (with Tax) (Rs.)', 'DETAILS': totalSalesGross.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': '', 'DETAILS': '' },
    { 'CA AUDIT & TAX RETURN REPORT': '--- INWARD SUPPLIES (PURCHASES / GSTR-2B) ---', 'DETAILS': '' },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Purchase Bills Count', 'DETAILS': purchases.length },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Taxable Purchase (Rs.)', 'DETAILS': totalPurchasesTaxable.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Input CGST (Rs.)', 'DETAILS': totalPurchasesCgst.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Input SGST (Rs.)', 'DETAILS': totalPurchasesSgst.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Eligible ITC (Rs.)', 'DETAILS': totalInputGst.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Gross Purchases (Rs.)', 'DETAILS': totalPurchasesGross.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': '', 'DETAILS': '' },
    { 'CA AUDIT & TAX RETURN REPORT': '--- NET TAX POSITION ---', 'DETAILS': '' },
    { 'CA AUDIT & TAX RETURN REPORT': 'Net GST Payable to Govt (Rs.)', 'DETAILS': netGstPayable.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Excess ITC Available to Carry Forward (Rs.)', 'DETAILS': itcBalance.toFixed(2) },
    { 'CA AUDIT & TAX RETURN REPORT': 'Total Indirect Expenses (Rs.)', 'DETAILS': totalExpenses.toFixed(2) },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tax Summary');

  // Sheet 2: GSTR-1 Sales Register
  const salesRows = invoices.map((inv, idx) => {
    const gross = Number(inv.amount || inv.total || 0);
    const tax = Number(inv.tax || inv.total_tax || 0);
    const taxable = Number(inv.subtotal || (gross - tax) || 0);
    const isInterstate = inv.is_interstate || (inv.place_of_supply && businessProfile.state && inv.place_of_supply !== businessProfile.state);
    const invDate = inv.created_at || inv.createdAt || inv.date || '';
    const dateFormatted = invDate ? new Date(invDate).toLocaleDateString() : 'N/A';

    return {
      'Sr.': idx + 1,
      'Invoice No': inv.invoice_number || inv.invoiceNumber || inv.id || 'N/A',
      'Invoice Date': dateFormatted,
      'Customer Name': inv.customer_name || inv.customerName || 'Walk-in / Cash Sale',
      'Customer GSTIN': inv.customer_gstin || inv.gstin || 'URP (Unregistered)',
      'Place of Supply': inv.place_of_supply || businessProfile.state || 'N/A',
      'Supply Type': isInterstate ? 'Inter-State' : 'Intra-State',
      'Invoice Type': (inv.customer_gstin && inv.customer_gstin.length === 15) ? 'B2B' : 'B2C',
      'Taxable Value (Rs.)': taxable.toFixed(2),
      'CGST Amount (Rs.)': isInterstate ? '0.00' : (tax / 2).toFixed(2),
      'SGST Amount (Rs.)': isInterstate ? '0.00' : (tax / 2).toFixed(2),
      'IGST Amount (Rs.)': isInterstate ? tax.toFixed(2) : '0.00',
      'Total Tax (Rs.)': tax.toFixed(2),
      'Invoice Total (Rs.)': gross.toFixed(2),
      'Payment Status': (inv.status || 'UNPAID').toUpperCase(),
      'Due Date': inv.dueDate || inv.due_date || 'N/A'
    };
  });
  const salesSheet = XLSX.utils.json_to_sheet(salesRows.length > 0 ? salesRows : [{ 'Notice': 'No Sales Invoices in selected period' }]);
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'GSTR-1 Sales');

  // Sheet 3: GSTR-2B Purchases Register
  const purchasesRows = purchases.map((pur, idx) => {
    const gross = Number(pur.total || pur.amount || 0);
    const tax = Number(pur.tax || 0);
    const taxable = Number(pur.subtotal || (gross - tax) || 0);
    const purDate = pur.date || pur.created_at || '';
    const dateFormatted = purDate ? new Date(purDate).toLocaleDateString() : 'N/A';

    return {
      'Sr.': idx + 1,
      'Bill / Ref No': pur.bill_number || pur.billNumber || pur.invoice_number || pur.id || 'N/A',
      'Bill Date': dateFormatted,
      'Supplier Name': pur.supplier_name || pur.supplierName || 'N/A',
      'Supplier GSTIN': pur.supplier_gstin || pur.gstin || 'URP (Unregistered)',
      'Taxable Amount (Rs.)': taxable.toFixed(2),
      'CGST (Rs.)': (tax / 2).toFixed(2),
      'SGST (Rs.)': (tax / 2).toFixed(2),
      'IGST (Rs.)': '0.00',
      'Total Tax (Rs.)': tax.toFixed(2),
      'Bill Total (Rs.)': gross.toFixed(2),
      'Status': (pur.status || 'PAID').toUpperCase()
    };
  });
  const purchasesSheet = XLSX.utils.json_to_sheet(purchasesRows.length > 0 ? purchasesRows : [{ 'Notice': 'No Purchase Bills recorded in selected period' }]);
  XLSX.utils.book_append_sheet(workbook, purchasesSheet, 'GSTR-2B Purchases');

  // Sheet 4: Expenses Register
  const expensesRows = expenses.map((exp, idx) => {
    const expDate = exp.date || exp.created_at || '';
    const dateFormatted = expDate ? new Date(expDate).toLocaleDateString() : 'N/A';
    return {
      'Sr.': idx + 1,
      'Expense Date': dateFormatted,
      'Category': exp.category || 'General Expense',
      'Title / Description': exp.title || exp.description || 'N/A',
      'Payment Mode': exp.payment_method || exp.paymentMethod || 'Cash',
      'Amount (Rs.)': Number(exp.amount || 0).toFixed(2)
    };
  });
  const expensesSheet = XLSX.utils.json_to_sheet(expensesRows.length > 0 ? expensesRows : [{ 'Notice': 'No Expenses recorded in selected period' }]);
  XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses Register');

  // Sheet 5: Debtors Ledger
  const debtorsRows = customers.map((c, idx) => {
    const custInvoices = invoices.filter(inv => inv.customer_id === c.id || inv.customerName === c.name || inv.customer_name === c.name);
    const custPayments = payments.filter(p => p.customer_id === c.id || p.customerName === c.name);
    
    const billed = custInvoices.reduce((acc, inv) => acc + Number(inv.amount || inv.total || 0), 0);
    const received = custPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const balance = billed - received;

    return {
      'Sr.': idx + 1,
      'Customer Name': c.name || 'N/A',
      'Phone': c.phone || 'N/A',
      'GSTIN': c.gstin || 'Unregistered',
      'State': c.state || 'N/A',
      'Total Invoiced (Rs.)': billed.toFixed(2),
      'Total Received (Rs.)': received.toFixed(2),
      'Outstanding Balance (Rs.)': balance.toFixed(2),
      'Status': balance <= 0 ? 'CLEARED' : 'PENDING'
    };
  });
  const debtorsSheet = XLSX.utils.json_to_sheet(debtorsRows.length > 0 ? debtorsRows : [{ 'Notice': 'No Customers on record' }]);
  XLSX.utils.book_append_sheet(workbook, debtorsSheet, 'Debtors Ledger');

  const cleanBizName = (businessProfile.businessName || 'Business').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `InvoCentric_CA_Data_${cleanBizName}_${cleanPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(workbook, fileName);
  return fileName;
}
