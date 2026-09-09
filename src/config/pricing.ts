/**
 * Centralized Pricing & Entitlements Source of Truth for InvoCentric
 * Used across Landing Page, Pricing Page, SEO Landing Pages, and In-App Modals.
 */

export interface PricingPlan {
  id: 'free' | 'pro';
  name: string;
  badge?: string;
  priceMonthly: number;
  priceYearly: number;
  priceLabel: string;
  billingPeriodLabel: string;
  description: string;
  limits: {
    invoices: string;
    customers: string;
    items: string;
    users: string;
    watermark: string;
    cloudSync: string;
    aiScan: string;
    posMode: string;
    barcodeLabels: string;
    support: string;
  };
  features: {
    text: string;
    included: boolean;
    highlight?: boolean;
  }[];
  ctaText: string;
  ctaSubtext: string;
}

export const PRICING_PLANS: Record<'free' | 'pro', PricingPlan> = {
  free: {
    id: 'free',
    name: 'Free Plan',
    priceMonthly: 0,
    priceYearly: 0,
    priceLabel: '₹0 forever',
    billingPeriodLabel: 'Free Plan — ₹0 forever',
    description: 'Essential billing, customers, inventory, payments, and daily-book features for new shops and small businesses. Usage limits apply as shown below.',
    limits: {
      invoices: 'Unlimited manual invoices & estimates',
      customers: 'Up to 30 customer/party accounts',
      items: 'Up to 50 inventory products',
      users: '1 user (owner device)',
      watermark: 'Zero watermarks on printed/PDF invoices',
      cloudSync: 'Offline-first device storage',
      aiScan: 'Not included (available on Pro)',
      posMode: 'Standard billing (QuickPOS on Pro)',
      barcodeLabels: 'Manual scan input',
      support: 'Standard community & email support'
    },
    features: [
      { text: 'Unlimited manual GST & non-GST invoices', included: true },
      { text: 'Up to 30 Customers / Parties', included: true },
      { text: 'Up to 50 Items in Inventory catalog', included: true },
      { text: 'Customer & Supplier Khata (Ledger Book)', included: true },
      { text: '11+ Professional Invoice & Thermal Print Templates', included: true },
      { text: 'Zero Watermark on PDF & WhatsApp shared bills', included: true },
      { text: 'Offline-first local device storage', included: true },
      { text: 'Current Month Sales & GST Summary Reports', included: true },
      { text: 'Multi-Device Realtime Cloud Sync', included: false },
      { text: 'AI Bill Scan OCR (Auto-fill purchase bills)', included: false },
      { text: 'QuickPOS High-Speed Retail Counter Mode', included: false },
      { text: 'A4 & Thermal Barcode Sticker Sheet Printing', included: false }
    ],
    ctaText: 'Create Your Free Account',
    ctaSubtext: 'No credit card required. Setup takes less than a minute.'
  },
  pro: {
    id: 'pro',
    name: 'Pro Plan',
    badge: 'Most Popular for Retailers',
    priceMonthly: 199,
    priceYearly: 1999,
    priceLabel: '₹199',
    billingPeriodLabel: 'Pro Plan — ₹199/month (or ₹1,999/year)',
    description: 'Advanced automation, unlimited business data, exports, multi-device sync, and priority support for growing businesses.',
    limits: {
      invoices: 'Unlimited invoices, quotations & receipts',
      customers: 'Unlimited customers and vendors',
      items: 'Unlimited product catalog & variants',
      users: 'Multi-device access',
      watermark: 'Zero watermarks',
      cloudSync: 'Real-time multi-device cloud backup & sync',
      aiScan: 'Unlimited AI purchase bill OCR scanner',
      posMode: 'Full QuickPOS retail checkout mode',
      barcodeLabels: 'Custom barcode sticker & label generator',
      support: 'Priority 24/7 WhatsApp & Phone helpdesk'
    },
    features: [
      { text: 'Unlimited Invoices, Quotations & POS Receipts', included: true, highlight: true },
      { text: 'Unlimited Customers, Vendors & Party Khata', included: true, highlight: true },
      { text: 'Unlimited Items & Warehouse Stock Tracking', included: true, highlight: true },
      { text: 'Multi-Device Instant Cloud Backup & Live Sync', included: true, highlight: true },
      { text: 'AI Bill Scan OCR: Snap supplier bills to auto-load stock', included: true, highlight: true },
      { text: 'QuickPOS High-Speed Retail Counter with barcode gun support', included: true },
      { text: 'A4 (24/65-in-1) & Thermal Barcode Sticker Label Printing', included: true },
      { text: 'Party-Wise Last Selling Price auto-memory', included: true },
      { text: '1-Click WhatsApp Payment Reminders with Dynamic UPI QR', included: true },
      { text: 'Advance Payment Auto-Adjustment in Invoices', included: true },
      { text: 'Full Data Export (Excel, Tally-ready CSV, JSON backup)', included: true },
      { text: 'Priority 24/7 WhatsApp & Phone Support', included: true }
    ],
    ctaText: 'Upgrade to Pro Plan',
    ctaSubtext: '7-day money-back guarantee. Cancel anytime.'
  }
};

/**
 * Standard truthful messaging constants
 */
export const PRICING_MESSAGING = {
  heroTitle: 'GST Billing and Inventory Software for Indian Small Businesses',
  heroSubtitle: 'Create professional GST and non-GST invoices, manage stock, scan barcodes, track khata balances, and share bills through WhatsApp. Start with a free plan and upgrade when your business needs advanced tools.',
  heroBadge: 'Free Plan Available • No Credit Card Required',
  ctaPrimary: 'Create Your Free Account',
  ctaSecondary: 'See a Live POS Demo',
  ctaHelper: 'No credit card required. Setup takes less than a minute.',
  
  dataStorageExplanation: 'InvoCentric is designed for offline-first billing. Your working data is stored securely on your device. Pro users can enable cloud backup and multi-device sync where available. Backup availability, sync timing, and supported devices are shown inside the app.',
  
  gstDisclaimer: 'InvoCentric generates invoices and reports using the information entered by the user. Verify GSTIN, HSN/SAC codes, tax rates, place of supply, and return data with your accountant or tax advisor before filing.',
  
  gstBadgeText: 'Supports common CGST, SGST, and IGST invoice fields'
};
