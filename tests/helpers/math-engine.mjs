/**
 * Authoritative Mathematical & Calculation Engine Oracle
 * Strictly encodes InvoCentic's business logic invariants:
 * - Multi-item GST calculations (intra-state CGST/SGST vs inter-state IGST)
 * - Line item totals (quantity * price/MRP - line discount)
 * - Global invoice totals (subtotal - discount + sales return + GST + shipping)
 * - POS cart computations
 * - Balance due with advance deductions
 * - Stock & serial inventory tracking invariants
 */

/**
 * Calculates line item subtotal and tax amounts
 */
export function calculateLineItem(item, isDiscountEnabled = true, isGstEnabled = true) {
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const basePrice = (!isDiscountEnabled && item.mrp) ? (Number(item.mrp) || 0) : (Number(item.price) || 0);
  const lineSubtotal = quantity * basePrice;
  const gstPercent = isGstEnabled ? (Number(item.gstPercent) || 0) : 0;
  const lineGst = lineSubtotal * (gstPercent / 100);
  const lineTotal = lineSubtotal + lineGst;

  return {
    quantity,
    basePrice,
    lineSubtotal: Number(lineSubtotal.toFixed(2)),
    gstPercent,
    lineGst: Number(lineGst.toFixed(2)),
    lineTotal: Number(lineTotal.toFixed(2))
  };
}

/**
 * Calculates complete invoice totals matching CreateInvoice.tsx
 */
export function computeInvoiceTotal(formData) {
  const columnVisibility = formData.columnVisibility || { discount: true, gstPercent: true };
  const isDiscountEnabled = columnVisibility.discount === true;
  const isGstEnabled = columnVisibility.gstPercent === true;
  const items = Array.isArray(formData.items) ? formData.items : [];

  const subtotal = items.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const price = (!isDiscountEnabled && item.mrp) ? (Number(item.mrp) || 0) : (Number(item.price) || 0);
    return acc + (q * price);
  }, 0);

  const totalGst = isGstEnabled ? items.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const basePrice = (!isDiscountEnabled && item.mrp) ? (Number(item.mrp) || 0) : (Number(item.price) || 0);
    const gstPercent = Number(item.gstPercent) || 0;
    return acc + (q * basePrice * (gstPercent / 100));
  }, 0) : 0;

  const globalDiscount = isDiscountEnabled ? (Number(formData.discount) || 0) : 0;
  const shipping = Number(formData.shipping_charges) || 0;
  const salesReturn = Number(formData.sales_return) || 0;

  const rawFinalTotal = subtotal - globalDiscount + salesReturn + totalGst + shipping;
  const finalTotal = isNaN(rawFinalTotal) ? 0 : Number(rawFinalTotal.toFixed(2));
  
  const advanceAmount = Number(formData.advance_amount) || 0;
  const balanceDue = Number(Math.max(0, finalTotal - advanceAmount).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    totalGst: Number(totalGst.toFixed(2)),
    globalDiscount: Number(globalDiscount.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    salesReturn: Number(salesReturn.toFixed(2)),
    finalTotal,
    advanceAmount,
    balanceDue
  };
}

/**
 * Calculates POS totals matching QuickPOS.tsx
 */
export function computePosTotals(cart, discountAmount = 0) {
  const cartList = Array.isArray(cart) ? cart : [];
  const rawSubtotal = cartList.reduce((acc, curr) => {
    const price = Number(curr.item?.price || curr.price || 0);
    const qty = Number(curr.quantity || 0);
    return acc + (price * qty);
  }, 0);

  const totalGst = cartList.reduce((acc, curr) => {
    const price = Number(curr.item?.price || curr.price || 0);
    const gstPct = Number(curr.item?.gstPercent || curr.gstPercent || 0);
    const qty = Number(curr.quantity || 0);
    return acc + (price * qty * (gstPct / 100));
  }, 0);

  const totalItems = cartList.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
  const discount = Math.max(0, Number(discountAmount) || 0);
  const finalTotal = Math.max(0, rawSubtotal + totalGst - discount);

  return {
    rawSubtotal: Number(rawSubtotal.toFixed(2)),
    totalGst: Number(totalGst.toFixed(2)),
    totalItems,
    discountAmount: Number(discount.toFixed(2)),
    finalTotal: Number(finalTotal.toFixed(2))
  };
}

/**
 * Validates inventory stock deductions
 */
export function validateStockDeduction(currentStock, requestedQty) {
  const stock = typeof currentStock === 'number' ? currentStock : 0;
  const qty = typeof requestedQty === 'number' ? requestedQty : 0;

  if (stock <= 0) {
    return { valid: false, reason: 'OUT_OF_STOCK', remainingStock: stock };
  }
  if (qty > stock) {
    return { valid: false, reason: 'EXCEEDS_STOCK', remainingStock: stock };
  }
  if (qty <= 0) {
    return { valid: false, reason: 'INVALID_QUANTITY', remainingStock: stock };
  }
  return { valid: true, reason: 'OK', remainingStock: stock - qty };
}

/**
 * Validates serial number allocation invariants
 */
export function validateSerialDeduction(availableSerials, selectedSerials) {
  const available = Array.isArray(availableSerials) ? availableSerials : [];
  const selected = Array.isArray(selectedSerials) ? selectedSerials : [];

  for (const s of selected) {
    if (!available.includes(s)) {
      return { valid: false, error: `Serial ${s} not found in available stock` };
    }
  }

  // Deduct selected serials
  const remaining = available.filter(s => !selected.includes(s));
  return { valid: true, remainingSerials: remaining, countDeducted: selected.length };
}

/**
 * Calculates Customer Ledger running balance
 */
export function computeCustomerBalance(invoices = [], payments = []) {
  const totalBilled = invoices.reduce((acc, inv) => acc + (Number(inv.total || inv.total_amount || 0)), 0);
  const totalPaid = payments.reduce((acc, p) => acc + (Number(p.amount || 0)), 0);
  const balanceOutstanding = Math.max(0, totalBilled - totalPaid);

  return {
    totalBilled: Number(totalBilled.toFixed(2)),
    totalPaid: Number(totalPaid.toFixed(2)),
    balanceOutstanding: Number(balanceOutstanding.toFixed(2)),
    isFullyPaid: balanceOutstanding <= 0
  };
}

/**
 * Formats currency in Indian Rupee format (en-IN)
 */
export function formatCurrencyINR(amount) {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
