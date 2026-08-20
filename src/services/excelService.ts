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
