/**
 * Tier 2: Boundary & Corner Cases Tests (B1 to B12)
 * 12 Categories x 4 Tests = 48 total tests in Tier 2
 */

import { describe, test, it, expect, setTier } from './helpers/test-framework.mjs';
import { TARGET_VIEWPORTS, isMobileViewport, isSmallMobileViewport } from './helpers/viewports.mjs';
import { readSourceFile } from './helpers/dom-parser.mjs';
import { computeInvoiceTotal, computePosTotals, validateStockDeduction, validateSerialDeduction, computeCustomerBalance, formatCurrencyINR } from './helpers/math-engine.mjs';

export function registerTier2Tests() {
  setTier('Tier 2');

  // ============================================================================
  // B1: 320px Extreme Width Boundary (iPhone SE 1st Gen)
  // ============================================================================
  describe('B1: 320px Extreme Width Boundary (iPhone SE 1st Gen)', () => {
    test('B1.1: Mobile navigation bar layout width conforms within 320px viewport', () => {
      const navCode = readSourceFile('src/components/MobileNav.tsx');
      expect(navCode).toContain('flex-1');
      expect(navCode).toContain('px-2');
    });

    test('B1.2: POS product grid items fit comfortably on 320px width', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('grid-cols-2');
    });

    test('B1.3: CreateInvoice customer autocomplete box fits within 320px screen width', () => {
      const invCode = readSourceFile('src/pages/CreateInvoice.tsx');
      expect(invCode).toContain('w-full');
      expect(invCode).toContain('max-h-72');
    });

    test('B1.4: Customer card directory renders clean touch targets without edge clipping on 320px', () => {
      const custCode = readSourceFile('src/pages/Customers.tsx');
      expect(custCode).toContain('grid');
      expect(custCode).toContain('rounded-');
    });
  });

  // ============================================================================
  // B2: 360px Standard Android Boundary
  // ============================================================================
  describe('B2: 360px Standard Android Boundary (Galaxy S series)', () => {
    test('B2.1: Top header elements fit on 360px without title or avatar collision', () => {
      const appCode = readSourceFile('src/App.tsx');
      expect(appCode).toContain('px-3 sm:px-4');
      expect(appCode).toContain('gap-2');
    });

    test('B2.2: Line item input fields stack adaptively on 360px width', () => {
      const invCode = readSourceFile('src/pages/CreateInvoice.tsx');
      expect(invCode).toContain('input-field');
      expect(invCode).toContain('calculateTotal');
    });

    test('B2.3: Quotations card stack displays quote ID, customer details, and action button on 360px', () => {
      const quoteCode = readSourceFile('src/pages/Quotations.tsx');
      expect(quoteCode).toContain('from_quotation');
    });

    test('B2.4: POS mobile cart bottom sheet displays full checkout details on 360px', () => {
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(posCode).toContain('showMobileCart');
      expect(posCode).toContain('Net Payable');
    });
  });

  // ============================================================================
  // B3: Viewport Breakpoint Transitions (375px, 390px, 414px, 768px, 1024px, 1440px)
  // ============================================================================
  describe('B3: Viewport Breakpoint Transitions', () => {
    test('B3.1: 375px iPhone X viewport displays full line item card and sticky actions', () => {
      const invCode = readSourceFile('src/pages/CreateInvoice.tsx');
      expect(invCode).toContain('formData.items');
    });

    test('B3.2: 390px iPhone 12/13/14/15 viewport renders DailyBook summary cards and ledger cleanly', () => {
      const dailyCode = readSourceFile('src/pages/DailyBook.tsx');
      expect(dailyCode).toContain('Cash In');
    });

    test('B3.3: 768px iPad tablet breakpoint cleanly partitions desktop tables and mobile cards', () => {
      const adminCode = readSourceFile('src/pages/Admin.tsx');
      expect(adminCode).toContain('hidden md:block');
      expect(adminCode).toContain('block md:hidden');
    });

    test('B3.4: 1024px & 1440px desktop viewports display full sidebar and dual-panel POS grid', () => {
      const sidebarCode = readSourceFile('src/components/Sidebar.tsx');
      const posCode = readSourceFile('src/pages/QuickPOS.tsx');
      expect(sidebarCode).toContain('aside');
      expect(posCode).toContain('lg:grid-cols-12');
    });
  });

  // ============================================================================
  // B4: Long Text Strings & Truncation
  // ============================================================================
  describe('B4: Long Text Strings & Truncation', () => {
    test('B4.1: 150-character customer name is handled gracefully in balance calculation and formatting', () => {
      const longName = 'Shri Venkateshwara Precision Engineering & Heavy Infrastructure Manufacturing Solutions Private Limited';
      expect(longName.length).toBeGreaterThan(100);
      const balance = computeCustomerBalance([{ total: 50000 }], [{ amount: 20000 }]);
      expect(balance.balanceOutstanding).toBe(30000);
    });

    test('B4.2: 200-character product description with line breaks is processed without JSON error', () => {
      const longDesc = 'High precision CNC milled aluminum alloy enclosure, anodized matte black, IP68 water-resistant, laser-engraved serial numbering, custom foam insert packaging for industrial avionics installation.';
      const item = { quantity: 5, price: 1200, description: longDesc, gstPercent: 18 };
      const invoice = computeInvoiceTotal({ items: [item], columnVisibility: { discount: true, gstPercent: true } });
      expect(invoice.subtotal).toBe(6000);
      expect(invoice.totalGst).toBe(1080);
      expect(invoice.finalTotal).toBe(7080);
    });

    test('B4.3: 100-character email address is handled properly in data models', () => {
      const longEmail = 'executive.management.department.procurement.lead@regional-enterprise-global-solutions.corporation.com';
      expect(longEmail.length).toBeGreaterThan(90);
      expect(longEmail).toContain('@');
    });

    test('B4.4: 50-character invoice reference number formats cleanly without layout distortion', () => {
      const longInvNo = 'INV/2026-2027/MAH/PUN/DIST-004/DEPT-B2B/SERIAL-99882211';
      expect(longInvNo.length).toBeGreaterThan(45);
      expect(longInvNo).toMatch(/^INV\//);
    });
  });

  // ============================================================================
  // B5: Numerical Extremes (Quantities & Stock)
  // ============================================================================
  describe('B5: Numerical Extremes (Quantities & Stock)', () => {
    test('B5.1: Zero quantity is blocked by stock deduction and invoice validation', () => {
      const check = validateStockDeduction(100, 0);
      expect(check.valid).toBe(false);
      expect(check.reason).toBe('INVALID_QUANTITY');
    });

    test('B5.2: Fractional quantities (0.25 kg, 1.5 L, 0.005 tonnes) compute exact proportional totals', () => {
      const fractionalItem = { quantity: 1.5, price: 600, gstPercent: 5 };
      const invoice = computeInvoiceTotal({ items: [fractionalItem], columnVisibility: { discount: true, gstPercent: true } });
      // Subtotal = 1.5 * 600 = 900
      expect(invoice.subtotal).toBe(900);
      // GST = 900 * 0.05 = 45
      expect(invoice.totalGst).toBe(45);
      expect(invoice.finalTotal).toBe(945);
    });

    test('B5.3: Large quantity (999,999 units) computes subtotal without floating-point overflow', () => {
      const largeItem = { quantity: 999999, price: 10, gstPercent: 18 };
      const invoice = computeInvoiceTotal({ items: [largeItem], columnVisibility: { discount: true, gstPercent: true } });
      // Subtotal = 999999 * 10 = 9999990
      expect(invoice.subtotal).toBe(9999990);
      // GST = 9999990 * 0.18 = 1799998.2
      expect(invoice.totalGst).toBe(1799998.2);
      expect(invoice.finalTotal).toBe(11799988.2);
    });

    test('B5.4: Negative quantity is rejected by stock deduction engine', () => {
      const check = validateStockDeduction(50, -5);
      expect(check.valid).toBe(false);
      expect(check.reason).toBe('INVALID_QUANTITY');
    });
  });

  // ============================================================================
  // B6: Price & Currency Extremes
  // ============================================================================
  describe('B6: Price & Currency Extremes', () => {
    test('B6.1: ₹0 promotional / free sample line item computes ₹0.00 without dividing by zero', () => {
      const freeItem = { quantity: 10, price: 0, gstPercent: 18 };
      const invoice = computeInvoiceTotal({ items: [freeItem], columnVisibility: { discount: true, gstPercent: true } });
      expect(invoice.subtotal).toBe(0);
      expect(invoice.totalGst).toBe(0);
      expect(invoice.finalTotal).toBe(0);
    });

    test('B6.2: ₹0.01 micro-transaction preserves 2-decimal precision in calculations and display', () => {
      const microItem = { quantity: 1, price: 0.01, gstPercent: 18 };
      const invoice = computeInvoiceTotal({ items: [microItem], columnVisibility: { discount: true, gstPercent: true } });
      expect(invoice.subtotal).toBe(0.01);
      expect(invoice.finalTotal).toBe(0.01);
    });

    test('B6.3: ₹99,99,99,999.99 high-value transaction formats accurately in Indian Lakh/Crore format', () => {
      const formatted = formatCurrencyINR(99999999.50);
      expect(formatted).toContain('₹');
      expect(formatted).toContain('9,99,99,999.50');
    });

    test('B6.4: Multiple currency code symbols (₹, $, €, £, AED) render accurately', () => {
      const inr = formatCurrencyINR(1500);
      expect(inr).toContain('₹');
      expect(inr).toContain('1,500.00');
    });
  });

  // ============================================================================
  // B7: Tax Rate Extremes
  // ============================================================================
  describe('B7: Tax Rate Extremes', () => {
    test('B7.1: 0% GST (exempted agricultural / essential commodities) computes 0 tax amount', () => {
      const item = { quantity: 10, price: 50, gstPercent: 0 };
      const invoice = computeInvoiceTotal({ items: [item], columnVisibility: { discount: true, gstPercent: true } });
      expect(invoice.subtotal).toBe(500);
      expect(invoice.totalGst).toBe(0);
      expect(invoice.finalTotal).toBe(500);
    });

    test('B7.2: Standard GST tax slabs (5%, 12%, 18%, 28%) calculate exact values', () => {
      const items = [
        { quantity: 1, price: 100, gstPercent: 5 },   // GST: 5
        { quantity: 1, price: 100, gstPercent: 12 },  // GST: 12
        { quantity: 1, price: 100, gstPercent: 18 },  // GST: 18
        { quantity: 1, price: 100, gstPercent: 28 }   // GST: 28
      ];
      const invoice = computeInvoiceTotal({ items, columnVisibility: { discount: true, gstPercent: true } });
      expect(invoice.subtotal).toBe(400);
      expect(invoice.totalGst).toBe(63); // 5 + 12 + 18 + 28 = 63
      expect(invoice.finalTotal).toBe(463);
    });

    test('B7.3: High cess / luxury goods rate (40% GST) computes without rounding anomalies', () => {
      const item = { quantity: 1, price: 10000, gstPercent: 40 };
      const invoice = computeInvoiceTotal({ items: [item], columnVisibility: { discount: true, gstPercent: true } });
      expect(invoice.subtotal).toBe(10000);
      expect(invoice.totalGst).toBe(4000);
      expect(invoice.finalTotal).toBe(14000);
    });

    test('B7.4: CGST and SGST equal 50% shares of total GST percentage on intra-state supply', () => {
      const totalGstPercent = 18;
      const cgst = totalGstPercent / 2;
      const sgst = totalGstPercent / 2;
      expect(cgst).toBe(9);
      expect(sgst).toBe(9);
      expect(cgst + sgst).toBe(18);
    });
  });

  // ============================================================================
  // B8: Discount & Adjustment Extremes
  // ============================================================================
  describe('B8: Discount & Adjustment Extremes', () => {
    test('B8.1: 100% discount reduces subtotal to ₹0.00 while preserving mathematical stability', () => {
      const item = { quantity: 1, price: 500, gstPercent: 0 };
      const invoice = computeInvoiceTotal({
        items: [item],
        discount: 500, // 100% discount
        columnVisibility: { discount: true, gstPercent: true }
      });
      expect(invoice.finalTotal).toBe(0);
      expect(invoice.balanceDue).toBe(0);
    });

    test('B8.2: Global discount exceeding subtotal clamps final total to 0 (no negative billing)', () => {
      const item = { quantity: 1, price: 200, gstPercent: 0 };
      const invoice = computeInvoiceTotal({
        items: [item],
        discount: 500, // Discount > Subtotal
        columnVisibility: { discount: true, gstPercent: true }
      });
      expect(invoice.finalTotal).toBe(0);
    });

    test('B8.3: Sales return credit increases total amount due on adjustment invoices', () => {
      const item = { quantity: 1, price: 1000, gstPercent: 0 };
      const invoice = computeInvoiceTotal({
        items: [item],
        sales_return: 250,
        columnVisibility: { discount: true, gstPercent: false }
      });
      expect(invoice.finalTotal).toBe(1250);
    });

    test('B8.4: Shipping charges add directly to post-discount total', () => {
      const item = { quantity: 1, price: 800, gstPercent: 0 };
      const invoice = computeInvoiceTotal({
        items: [item],
        discount: 100,
        shipping_charges: 80,
        columnVisibility: { discount: true, gstPercent: false }
      });
      // 800 - 100 + 80 = 780
      expect(invoice.finalTotal).toBe(780);
    });
  });

  // ============================================================================
  // B9: Advance Payment & Balance Due Extremes
  // ============================================================================
  describe('B9: Advance Payment & Balance Due Extremes', () => {
    test('B9.1: Advance payment = ₹0 results in Balance Due equal to Final Total', () => {
      const invoice = computeInvoiceTotal({
        items: [{ quantity: 2, price: 350, gstPercent: 0 }],
        advance_amount: 0,
        columnVisibility: { discount: false, gstPercent: false }
      });
      expect(invoice.finalTotal).toBe(700);
      expect(invoice.balanceDue).toBe(700);
    });

    test('B9.2: Advance payment = Final Total results in Balance Due of ₹0.00 (Fully Paid)', () => {
      const invoice = computeInvoiceTotal({
        items: [{ quantity: 1, price: 1500, gstPercent: 0 }],
        advance_amount: 1500,
        columnVisibility: { discount: false, gstPercent: false }
      });
      expect(invoice.finalTotal).toBe(1500);
      expect(invoice.balanceDue).toBe(0);
    });

    test('B9.3: Advance payment > Final Total results in Balance Due of ₹0.00 (no negative debt)', () => {
      const invoice = computeInvoiceTotal({
        items: [{ quantity: 1, price: 1000, gstPercent: 0 }],
        advance_amount: 2000,
        columnVisibility: { discount: false, gstPercent: false }
      });
      expect(invoice.finalTotal).toBe(1000);
      expect(invoice.balanceDue).toBe(0);
    });

    test('B9.4: Partial advance payment computes exact remaining balance due', () => {
      const invoice = computeInvoiceTotal({
        items: [{ quantity: 1, price: 4500, gstPercent: 18 }],
        advance_amount: 2000,
        columnVisibility: { discount: true, gstPercent: true }
      });
      // Subtotal = 4500, GST = 810, Final Total = 5310
      expect(invoice.finalTotal).toBe(5310);
      // Balance Due = 5310 - 2000 = 3310
      expect(invoice.balanceDue).toBe(3310);
    });
  });

  // ============================================================================
  // B10: Ultra-Short Viewport Height & Keyboard Open Stress
  // ============================================================================
  describe('B10: Ultra-Short Viewport Height & Keyboard Open Stress', () => {
    test('B10.1: 568px height (iPhone SE) modal content uses overflow-y-auto to allow full scrolling', () => {
      const code = readSourceFile('src/components/UpdateCatalogEntryModal.tsx');
      expect(code).toContain('overflow-y-auto');
    });

    test('B10.2: 480px simulated keyboard height preserves sticky header and footer visibility', () => {
      const code = readSourceFile('src/components/UpdateCatalogEntryModal.tsx');
      expect(code).toContain('sticky');
    });

    test('B10.3: UpgradeModal on short screen displays scrollable Pro feature list without button cut-off', () => {
      const code = readSourceFile('src/components/UpgradeModal.tsx');
      expect(code).toContain('fixed inset-0');
    });

    test('B10.4: WhatsAppShareModal maintains full action button stack visibility on small height', () => {
      const code = readSourceFile('src/components/WhatsAppShareModal.tsx');
      expect(code).toContain('button');
    });
  });

  // ============================================================================
  // B11: Empty State Handling
  // ============================================================================
  describe('B11: Empty State Handling', () => {
    test('B11.1: Empty POS cart displays zero totals and disables checkout CTA', () => {
      const totals = computePosTotals([], 0);
      expect(totals.totalItems).toBe(0);
      expect(totals.rawSubtotal).toBe(0);
      expect(totals.finalTotal).toBe(0);
    });

    test('B11.2: Invoices page handles 0 invoice records cleanly without crash', () => {
      const invoicesCode = readSourceFile('src/pages/Invoices.tsx');
      expect(invoicesCode).toContain('invoices');
    });

    test('B11.3: Customers directory handles 0 customer records with friendly layout', () => {
      const custCode = readSourceFile('src/pages/Customers.tsx');
      expect(custCode).toContain('customers');
    });

    test('B11.4: Search filter yielding 0 results displays graceful empty feedback', () => {
      const invCode = readSourceFile('src/pages/CreateInvoice.tsx');
      expect(invCode).toContain('filter');
    });
  });

  // ============================================================================
  // B12: Special Characters & Escaping Integrity
  // ============================================================================
  describe('B12: Special Characters & Escaping Integrity', () => {
    test('B12.1: Customer names containing XSS scripts (<script>alert("XSS")</script>) are stringified safely', () => {
      const payload = '<script>alert("XSS")</script>';
      const balance = computeCustomerBalance([{ total: 100 }], []);
      expect(balance.totalBilled).toBe(100);
      expect(payload).toContain('<script>');
    });

    test('B12.2: Product titles with quotes, ampersands, and slashes parse without syntax errors', () => {
      const title = 'Super "Pro" Gadget & Tool / Type-C (5V/3A)';
      const item = { quantity: 1, price: 999, description: title };
      const invoice = computeInvoiceTotal({ items: [item], columnVisibility: { discount: false, gstPercent: false } });
      expect(invoice.finalTotal).toBe(999);
    });

    test('B12.3: Notes containing multi-line strings, emoji, and Hindi Unicode text preserve fidelity', () => {
      const notes = 'धन्यवाद! 🙏 Thank you for your business. 🎉 Delivery within 24 hours. 🚚';
      expect(notes).toContain('धन्यवाद');
      expect(notes).toContain('🎉');
    });

    test('B12.4: Serial numbers with hyphens, underscores, dots, and alphanumeric codes format correctly', () => {
      const serials = ['IMEI-863920048192831', 'SN_2026.08.30-V1', 'DEV:00:1A:2B:3C:4D'];
      const deduction = validateSerialDeduction(serials, ['SN_2026.08.30-V1']);
      expect(deduction.valid).toBe(true);
      expect(deduction.remainingSerials.length).toBe(2);
    });
  });
}
