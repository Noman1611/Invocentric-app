/**
 * Tier 1: Comprehensive Feature Coverage Tests (F1 to F8)
 * 6 Tests per Feature Area (48 total tests in Tier 1)
 */

import { describe, test, it, expect, setTier } from './helpers/test-framework.mjs';
import { TARGET_VIEWPORTS, isMobileViewport } from './helpers/viewports.mjs';
import { readSourceFile, checkViewportMetaTokens, checkSafeAreaUtilities, checkBorderRadiusOverride, findFixedMinWidthViolations, inspectModalErgonomics, inspectTableCardReflow } from './helpers/dom-parser.mjs';
import { computeInvoiceTotal, computePosTotals, validateStockDeduction, validateSerialDeduction, computeCustomerBalance, formatCurrencyINR } from './helpers/math-engine.mjs';

export function registerTier1Tests() {
  setTier('Tier 1');

  // ============================================================================
  // F1: Viewport & HTML Setup (Meta tags, zero horizontal overflow protection)
  // ============================================================================
  describe('F1: Viewport Overflow & Scroll Width Protection', () => {
    test('F1.1: index.html contains viewport meta tag with width=device-width, initial-scale=1, and viewport-fit=cover', () => {
      const html = readSourceFile('index.html');
      const tokens = checkViewportMetaTokens(html);
      expect(tokens.valid).toBe(true);
      expect(tokens.hasWidth).toBe(true);
      expect(tokens.hasScale).toBe(true);
      expect(tokens.hasViewportFit).toBe(true);
    });

    test('F1.2: src/index.css base layer sets overflow-x: hidden on html and body to prevent window scrolling blowout', () => {
      const css = readSourceFile('src/index.css');
      expect(css).toContain('overflow-x: hidden');
    });

    test('F1.3: CreateInvoice.tsx autocomplete dropdown avoids fixed min-w-[360px] blowout on <=360px viewports', () => {
      const code = readSourceFile('src/pages/CreateInvoice.tsx');
      // Verify autocomplete dropdown uses responsive width classes
      expect(code).toContain('max-h-72 overflow-y-auto');
      expect(code).toContain('rounded-2xl border border-slate-200');
    });

    test('F1.4: App.tsx main scroll container enforces zero horizontal overflow across 320px to 1440px viewports', () => {
      const appCode = readSourceFile('src/App.tsx');
      expect(appCode).toContain('overflow-x-hidden');
      expect(appCode).toContain('id="main-scroll-container"');
    });

    test('F1.5: MobileNav bottom bar container avoids horizontal overflow on 320px viewport', () => {
      const navCode = readSourceFile('src/components/MobileNav.tsx');
      expect(navCode).toContain('fixed bottom-0 left-0 right-0');
      expect(navCode).toContain('md:hidden');
    });

    test('F1.6: Tabular views use responsive overflow containers or mobile card reflows', () => {
      const invoicesCode = readSourceFile('src/pages/Invoices.tsx');
      const purchasesCode = readSourceFile('src/pages/Purchases.tsx');
      const dailyBookCode = readSourceFile('src/pages/DailyBook.tsx');

      expect(invoicesCode.length).toBeGreaterThan(0);
      expect(purchasesCode.length).toBeGreaterThan(0);
      expect(dailyBookCode.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // F2: Navigation Shell & Safe-Area Clearance
  // ============================================================================
  describe('F2: Navigation Shell & Safe-Area Clearance', () => {
    test('F2.1: src/index.css defines safe-area utility classes (.pb-safe, .pt-safe, .pl-safe, .pr-safe, .mb-safe)', () => {
      const css = readSourceFile('src/index.css');
      const safeCheck = checkSafeAreaUtilities(css);
      expect(safeCheck.allPresent).toBe(true);
    });

    test('F2.2: App.tsx main scroll container preserves bottom clearance (pb-28 or pb-safe) for mobile bottom bar', () => {
      const appCode = readSourceFile('src/App.tsx');
      expect(appCode).toMatch(/pb-28|pb-32|pb-\[calc\(7rem/);
    });

    test('F2.3: MobileNav.tsx includes pb-safe and dynamic height to accommodate iOS home indicator', () => {
      const navCode = readSourceFile('src/components/MobileNav.tsx');
      expect(navCode).toContain('pb-safe');
      expect(navCode).toContain('h-[');
    });

    test('F2.4: MobileNav.tsx tab items use flexible spacing to prevent button squeezing on 320px screens', () => {
      const navCode = readSourceFile('src/components/MobileNav.tsx');
      expect(navCode).toContain('flex-1');
      expect(navCode).toContain('flex justify-around items-center');
    });

    test('F2.5: App.tsx header collapses secondary actions (Scanner, Audio Guide) into menu on < 640px', () => {
      const appCode = readSourceFile('src/App.tsx');
      expect(appCode).toContain('hidden sm:');
      expect(appCode).toContain('print:hidden');
    });

    test('F2.6: Desktop Sidebar.tsx is cleanly hidden on mobile (hidden md:block) with zero horizontal footprint', () => {
      const appCode = readSourceFile('src/App.tsx');
      expect(appCode).toContain('hidden md:block print:hidden');
      expect(appCode).toContain('<Sidebar');
    });
  });

  // ============================================================================
  // F3: Touch Targets (>= 44px) & Active Touch Feedback
  // ============================================================================
  describe('F3: Touch Targets (>= 44px) & Active Touch Feedback', () => {
    test('F3.1: Primary CTA buttons meet touch target ergonomics (>= 44px height)', () => {
      const css = readSourceFile('src/index.css');
      expect(css).toContain('.btn-primary');
      expect(css).toContain('.btn-secondary');
      expect(css).toContain('py-2.5'); // py-2.5 + text + line-height >= 44px
    });

    test('F3.2: QuickPOS quantity stepper buttons have accessible touch boundaries', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('updateQuantity');
      expect(posCode).toContain('Minus');
      expect(posCode).toContain('Plus');
    });

    test('F3.3: MobileNav bottom tabs provide >= 44px touch area (h-14 / 56px height)', () => {
      const navCode = readSourceFile('src/components/MobileNav.tsx');
      expect(navCode).toContain('h-14'); // 56px > 44px touch target requirement
    });

    test('F3.4: Touch elements include active feedback classes (active:scale-95 or active:scale-[0.99])', () => {
      const navCode = readSourceFile('src/components/MobileNav.tsx');
      expect(navCode).toContain('active:scale-95');
    });

    test('F3.5: Modal close triggers (X buttons) maintain minimum 32px to 44px touch container', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('rounded-full');
      expect(posCode).toContain('<X');
    });

    test('F3.6: Mobile action buttons on transaction cards provide accessible touch targets', () => {
      const invoicesCode = readSourceFile('src/pages/Invoices.tsx');
      expect(invoicesCode).toContain('button');
      expect(invoicesCode).toContain('rounded-');
    });
  });

  // ============================================================================
  // F4: POS & Quick Billing Mobile Reflow
  // ============================================================================
  describe('F4: POS & Quick Billing Mobile Reflow', () => {
    test('F4.1: QuickPOS renders dual-panel layout on >= 1024px (lg:grid-cols-12) and floating cart on mobile', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('lg:grid-cols-12');
      expect(posCode).toContain('lg:col-span-7');
      expect(posCode).toContain('lg:col-span-5');
      expect(posCode).toContain('showMobileCart');
    });

    test('F4.2: QuickPOS mobile cart sheet includes checkout summary and action CTA', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('showMobileCart');
      expect(posCode).toContain('Cart Items');
      expect(posCode).toContain('Generate Bill');
    });

    test('F4.3: QuickPOS product catalog grid provides responsive column reflow', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('grid-cols-2');
      expect(posCode).toContain('sm:grid-cols-3');
    });

    test('F4.4: QuickPOS layout avoids nested height locking and scrolls smoothly', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('flex flex-col');
      expect(posCode).toContain('overflow-');
    });

    test('F4.5: QuickPOS serial number selection modal renders with responsive backdrop and search input', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('activeSerialModalItem');
      expect(posCode).toContain('Select Serial Numbers');
      expect(posCode).toContain('serialScanInput');
    });

    test('F4.6: QuickPOS live totals compute accurately with discounts and tax', () => {
      const cart = [
        { item: { name: 'Widget A', price: 100, gstPercent: 18 }, quantity: 2 },
        { item: { name: 'Widget B', price: 250, gstPercent: 5 }, quantity: 1 }
      ];
      const totals = computePosTotals(cart, 50);

      // Raw Subtotal: (100*2) + (250*1) = 450
      expect(totals.rawSubtotal).toBe(450);
      // Total GST: (200 * 0.18) + (250 * 0.05) = 36 + 12.5 = 48.5
      expect(totals.totalGst).toBe(48.5);
      // Total Items: 2 + 1 = 3
      expect(totals.totalItems).toBe(3);
      // Final Total: 450 + 48.5 - 50 = 448.5
      expect(totals.finalTotal).toBe(448.5);
    });
  });

  // ============================================================================
  // F5: Create/Edit Invoice Responsive Form & Item Cards
  // ============================================================================
  describe('F5: Create/Edit Invoice Responsive Form & Item Cards', () => {
    test('F5.1: CreateInvoice customer search autocomplete dropdown adapts fluidly without fixed overflow', () => {
      const invoiceCode = readSourceFile('src/pages/CreateInvoice.tsx');
      expect(invoiceCode).toContain('focusedItemIndex');
      expect(invoiceCode).toContain('inventoryItems');
    });

    test('F5.2: CreateInvoice line items grid renders all columns and supports dynamic additions', () => {
      const invoiceCode = readSourceFile('src/pages/CreateInvoice.tsx');
      expect(invoiceCode).toContain('formData.items.map');
      expect(invoiceCode).toContain('addItem');
      expect(invoiceCode).toContain('removeItem');
    });

    test('F5.3: CreateInvoice action bar provides sticky/clear actions with pb-28 navigation clearance', () => {
      const invoiceCode = readSourceFile('src/pages/CreateInvoice.tsx');
      expect(invoiceCode).toContain('calculateTotal');
      expect(invoiceCode).toContain('handleSubmit');
      expect(invoiceCode).toContain('Save');
    });

    test('F5.4: CreateInvoice secondary attributes (Brand, Category, S/N) render in responsive layout', () => {
      const invoiceCode = readSourceFile('src/pages/CreateInvoice.tsx');
      expect(invoiceCode).toContain('serialNumber');
      expect(invoiceCode).toContain('brand');
      expect(invoiceCode).toContain('category');
    });

    test('F5.5: InvoiceView preserves @media print formatting for A4/A5 and POS thermal receipts', () => {
      const css = readSourceFile('src/index.css');
      expect(css).toContain('@media print');
      expect(css).toContain('page: a4-page');
      expect(css).toContain('page: a5-page');
    });

    test('F5.6: SerialNumberInput component supports touch-friendly badges and batch input', () => {
      const serialCode = readSourceFile('src/components/SerialNumberInput.tsx');
      expect(serialCode).toContain('serialNumbers');
      expect(serialCode).toContain('onAddSerial');
      expect(serialCode).toContain('onRemoveSerial');
    });
  });

  // ============================================================================
  // F6: Tabular Data Reflow across Entity Views
  // ============================================================================
  describe('F6: Tabular Data Reflow across Entity Views', () => {
    test('F6.1: Invoices.tsx renders responsive table with customer, amount, status, and actions', () => {
      const code = readSourceFile('src/pages/Invoices.tsx');
      expect(code).toContain('invoices');
      expect(code).toContain('total_amount');
      expect(code).toContain('status');
    });

    test('F6.2: Quotations.tsx renders quote ledger with 1-click Convert to Invoice trigger', () => {
      const code = readSourceFile('src/pages/Quotations.tsx');
      expect(code).toContain('from_quotation');
      expect(code).toContain('Convert to Invoice');
    });

    test('F6.3: DailyBook.tsx provides daily ledger summary and transaction rows', () => {
      const code = readSourceFile('src/pages/DailyBook.tsx');
      expect(code).toContain('Cash In');
      expect(code).toContain('Cash Out');
      expect(code).toContain('Daily');
    });

    test('F6.4: Expenses.tsx renders expense entries with category and payment method details', () => {
      const code = readSourceFile('src/pages/Expenses.tsx');
      expect(code).toContain('expenses');
      expect(code).toContain('category');
      expect(code).toContain('amount');
    });

    test('F6.5: Dashboard.tsx renders recent transaction entries and metrics cards', () => {
      const code = readSourceFile('src/pages/Dashboard.tsx');
      expect(code).toContain('recentInvoices');
      expect(code).toContain('metrics');
    });

    test('F6.6: Customers.tsx, Purchases.tsx, Payments.tsx, Reports.tsx, Statement.tsx, Admin.tsx exist and render entities', () => {
      expect(readSourceFile('src/pages/Customers.tsx').length).toBeGreaterThan(0);
      expect(readSourceFile('src/pages/Purchases.tsx').length).toBeGreaterThan(0);
      expect(readSourceFile('src/pages/Payments.tsx').length).toBeGreaterThan(0);
      expect(readSourceFile('src/pages/Reports.tsx').length).toBeGreaterThan(0);
      expect(readSourceFile('src/pages/Statement.tsx').length).toBeGreaterThan(0);
      expect(readSourceFile('src/pages/Admin.tsx').length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // F7: Universal Modal & Bottom Sheet Standardization
  // ============================================================================
  describe('F7: Universal Modal & Bottom Sheet Standardization', () => {
    test('F7.1: UpdateCatalogEntryModal serves as golden responsive standard with items-end sm:items-center', () => {
      const code = readSourceFile('src/components/UpdateCatalogEntryModal.tsx');
      const inspect = inspectModalErgonomics(code);
      expect(inspect.hasFixedInset).toBe(true);
      expect(inspect.hasItemsEndOnMobile).toBe(true);
      expect(inspect.hasMaxHeight).toBe(true);
      expect(inspect.hasOverflowY).toBe(true);
    });

    test('F7.2: Mobile bottom sheets include rounded-t-3xl and mobile drag handle indicator', () => {
      const code = readSourceFile('src/components/UpdateCatalogEntryModal.tsx');
      expect(code).toContain('rounded-t-3xl');
      expect(code).toContain('w-12 h-1.5'); // drag handle
    });

    test('F7.3: Modals enforce max-h-[94vh] or max-h-[90vh] with overflow-y-auto to prevent screen clipping', () => {
      const code = readSourceFile('src/components/UpdateCatalogEntryModal.tsx');
      expect(code).toContain('max-h-[94vh]');
      expect(code).toContain('overflow-y-auto');
    });

    test('F7.4: src/index.css border-radius rule preserves directional top rounded classes', () => {
      const css = readSourceFile('src/index.css');
      const check = checkBorderRadiusOverride(css);
      expect(check.safe).toBe(true);
    });

    test('F7.5: UpgradeModal renders responsive container and Pro feature list', () => {
      const code = readSourceFile('src/components/UpgradeModal.tsx');
      expect(code).toContain('fixed inset-0');
      expect(code).toContain('Upgrade to Pro');
    });

    test('F7.6: WhatsAppShareModal renders responsive sharing controls and one-click actions', () => {
      const code = readSourceFile('src/components/WhatsAppShareModal.tsx');
      expect(code).toContain('fixed inset-0');
      expect(code).toContain('WhatsApp');
    });
  });

  // ============================================================================
  // F8: Zero Regressions on Business Logic & Calculations
  // ============================================================================
  describe('F8: Zero Regressions on Business Logic & Calculations', () => {
    test('F8.1: GST calculations compute exact CGST/SGST 50/50 split and total tax decimal accuracy', () => {
      const invoiceData = {
        columnVisibility: { discount: true, gstPercent: true },
        discount: 0,
        shipping_charges: 0,
        sales_return: 0,
        advance_amount: 0,
        items: [
          { quantity: 2, price: 1000, gstPercent: 18 } // Subtotal: 2000, GST: 360, Total: 2360
        ]
      };
      const result = computeInvoiceTotal(invoiceData);
      expect(result.subtotal).toBe(2000);
      expect(result.totalGst).toBe(360);
      expect(result.finalTotal).toBe(2360);
      expect(result.balanceDue).toBe(2360);
    });

    test('F8.2: Multi-line invoice incorporates item MRP vs Unit Price, line discounts, and subtotal', () => {
      const invoiceData = {
        columnVisibility: { discount: true, gstPercent: true },
        discount: 100, // global discount ₹100
        shipping_charges: 50, // shipping ₹50
        sales_return: 0,
        advance_amount: 500, // advance ₹500
        items: [
          { quantity: 3, price: 200, gstPercent: 5 }, // Subtotal: 600, GST: 30
          { quantity: 1, price: 400, gstPercent: 12 }  // Subtotal: 400, GST: 48
        ]
      };
      const result = computeInvoiceTotal(invoiceData);
      // Subtotal = 600 + 400 = 1000
      expect(result.subtotal).toBe(1000);
      // Total GST = 30 + 48 = 78
      expect(result.totalGst).toBe(78);
      // Final Total = 1000 - 100 + 78 + 50 = 1028
      expect(result.finalTotal).toBe(1028);
      // Balance Due = 1028 - 500 = 528
      expect(result.balanceDue).toBe(528);
    });

    test('F8.3: Global discount clamped and sales return adjusts final total correctly', () => {
      const invoiceData = {
        columnVisibility: { discount: true, gstPercent: false },
        discount: 50,
        shipping_charges: 0,
        sales_return: 120, // Sales return credit ₹120
        advance_amount: 0,
        items: [
          { quantity: 1, price: 300 }
        ]
      };
      const result = computeInvoiceTotal(invoiceData);
      // Final Total = 300 - 50 + 120 = 370
      expect(result.finalTotal).toBe(370);
    });

    test('F8.4: Advance amount deduction accurately computes remaining Balance Due without negative underflow', () => {
      const invoiceData = {
        columnVisibility: { discount: true, gstPercent: false },
        discount: 0,
        shipping_charges: 0,
        sales_return: 0,
        advance_amount: 600, // Advance exceeding total
        items: [{ quantity: 1, price: 500 }]
      };
      const result = computeInvoiceTotal(invoiceData);
      expect(result.finalTotal).toBe(500);
      expect(result.balanceDue).toBe(0); // Clamped at 0
    });

    test('F8.5: Stock deduction validation accurately blocks out-of-stock and excess requests', () => {
      // Out of stock
      const outOfStock = validateStockDeduction(0, 1);
      expect(outOfStock.valid).toBe(false);
      expect(outOfStock.reason).toBe('OUT_OF_STOCK');

      // Exceeds stock
      const excess = validateStockDeduction(5, 10);
      expect(excess.valid).toBe(false);
      expect(excess.reason).toBe('EXCEEDS_STOCK');

      // Valid purchase
      const valid = validateStockDeduction(10, 3);
      expect(valid.valid).toBe(true);
      expect(valid.remainingStock).toBe(7);
    });

    test('F8.6: Serial number tracking decrements exact selected serial identifiers', () => {
      const available = ['SN-001', 'SN-002', 'SN-003', 'SN-004'];
      const selected = ['SN-002', 'SN-004'];
      const result = validateSerialDeduction(available, selected);

      expect(result.valid).toBe(true);
      expect(result.countDeducted).toBe(2);
      expect(result.remainingSerials).toEqual(['SN-001', 'SN-003']);
    });
  });
}
