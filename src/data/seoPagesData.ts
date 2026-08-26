export interface SeoLandingPageData {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  h1: string;
  subtitle: string;
  badge: string;
  heroHighlight: string;
  features: {
    title: string;
    description: string;
    iconName: string;
  }[];
  detailedSections: {
    heading: string;
    content: string[];
    bulletPoints?: string[];
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
  breadcrumbs: { name: string; url: string }[];
  ctaText: string;
  ctaSubtext: string;
  relatedPages: { title: string; slug: string; desc: string }[];
}

export const SEO_LANDING_PAGES: Record<string, SeoLandingPageData> = {
  'invoice-software': {
    slug: 'invoice-software',
    metaTitle: 'Invoice Software India | Professional Online Invoice Maker | InvoCentric',
    metaDescription: 'Free invoice software for small businesses in India. Create professional GST and non-GST invoices, custom templates, WhatsApp sharing, and instant PDF download with InvoCentric.',
    focusKeyword: 'invoice software',
    secondaryKeywords: ['invoice maker', 'invoice generator', 'online invoice software', 'invoice software India', 'free invoice software'],
    h1: 'Professional Invoice Software for Indian Small Businesses',
    subtitle: 'Generate beautiful GST-compliant invoices in under 30 seconds. Choose from 11+ professional standard & industry templates, share via WhatsApp, and manage payments effortlessly.',
    badge: '100% Free Cloud & Offline Invoice Software',
    heroHighlight: 'No credit card required • Zero watermarks • Unlimited invoices',
    features: [
      {
        title: '11+ Professional Invoice Templates',
        description: 'Choose from classic corporate, modern GST, compact retail, and thermal POS receipt designs tailored for Indian trade.',
        iconName: 'FileText'
      },
      {
        title: '1-Click WhatsApp & PDF Sharing',
        description: 'Send invoices directly to your clients on WhatsApp with automated payment reminders and UPI QR code links.',
        iconName: 'Smartphone'
      },
      {
        title: 'Offline & Cloud Synchronization',
        description: 'Create invoices without active internet connectivity. Data synchronizes automatically with Firestore cloud backup when reconnected.',
        iconName: 'RefreshCw'
      },
      {
        title: 'Automated Tax & Currency Words',
        description: 'Instant CGST, SGST, IGST calculation with automatic amount-in-words conversion in Indian Rupees.',
        iconName: 'Calculator'
      }
    ],
    detailedSections: [
      {
        heading: 'Why InvoCentric is the Preferred Invoice Software in India',
        content: [
          'Small businesses, freelancers, wholesalers, and retail store owners need an invoicing platform that is quick, reliable, and compliant with Indian GST tax laws. InvoCentric simplifies the billing process from start to finish.',
          'Unlike traditional accounting software that requires extensive training, InvoCentric lets you pick a client, add items, and produce a print-ready invoice in seconds with no forced watermark or trial expiry.'
        ],
        bulletPoints: [
          'Automatic HSN code lookup and GST rate auto-split (CGST/SGST/IGST)',
          'Custom logo, signature upload, bank details, and dynamic UPI QR code embedding',
          'Export invoices in high-resolution PDF or print to A4, A5 horizontal, or thermal paper rolls',
          'Track payment statuses (Paid, Partial, Unpaid/Sent, Draft) in real-time'
        ]
      }
    ],
    faqs: [
      {
        question: 'Is InvoCentric invoice software really free to use?',
        answer: 'Yes. InvoCentric provides free invoice creation with unlimited invoices, client management, and PDF exports without any watermarks or trial limits.'
      },
      {
        question: 'Can I generate both GST and Non-GST bills?',
        answer: 'Absolutely. You can select "INVOICE", "BILL OF SUPPLY", "CASH BILL", or "ESTIMATE" based on whether your business is GST registered or operating under composition/non-GST schemes.'
      },
      {
        question: 'Can I print invoices on thermal receipt printers?',
        answer: 'Yes, InvoCentric features dedicated POS thermal templates (2-inch 58mm and 3-inch 80mm) that format receipts cleanly for Bluetooth, USB, and thermal printers.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'Invoice Software', url: 'https://invocentric.in/invoice-software' }
    ],
    ctaText: 'Create Your First Invoice Now — 100% Free',
    ctaSubtext: 'No signup friction. Start billing in 30 seconds.',
    relatedPages: [
      { title: 'Free Invoice Maker', slug: 'free-invoice-maker', desc: 'Instant online PDF invoice generator' },
      { title: 'GST Billing Software', slug: 'gst-billing-software', desc: 'Complete GST accounting and tax invoices' },
      { title: 'Barcode Generator', slug: 'barcode-generator', desc: 'Create product barcode stickers & labels' }
    ]
  },

  'free-invoice-maker': {
    slug: 'free-invoice-maker',
    metaTitle: 'Free Invoice Maker | Online PDF Invoice Generator | InvoCentric',
    metaDescription: 'Create clean, professional invoices for free with InvoCentric. Online PDF invoice maker with no watermark, instant WhatsApp sharing, and custom business branding.',
    focusKeyword: 'free invoice maker',
    secondaryKeywords: ['free invoice generator', 'online invoice maker', 'free invoice software', 'PDF invoice maker', 'invoice template free'],
    h1: 'Free Online Invoice Maker with Zero Watermarks',
    subtitle: 'The simplest way to create and download professional PDF invoices online. Ideal for freelancers, consultants, contractors, and small business owners.',
    badge: 'No Watermarks • Instant PDF Download',
    heroHighlight: 'Fill the form • Preview in real-time • Download clean PDF',
    features: [
      {
        title: 'Instant Online Generation',
        description: 'Type customer and item details into an intuitive form and watch your invoice format in real-time.',
        iconName: 'Sparkles'
      },
      {
        title: 'Zero Branding Watermarks',
        description: 'Your invoices represent your business. Enjoy 100% clean, professional bills without third-party badges or forced watermarks.',
        iconName: 'Check'
      },
      {
        title: 'Built-in Payment QR Code',
        description: 'Auto-generate UPI QR codes for PhonePe, Google Pay, Paytm, and BHIM directly on your invoice PDF.',
        iconName: 'QrCode'
      },
      {
        title: 'Multi-Currency Support',
        description: 'Bill local or international clients with INR (₹), USD ($), EUR (€), GBP (£), and other major currencies.',
        iconName: 'Globe'
      }
    ],
    detailedSections: [
      {
        heading: 'How to Make Free Invoices Online in 3 Easy Steps',
        content: [
          'Creating a bill should never take more than a few moments. With InvoCentric free invoice maker, you enter your business details once, select your client, and export print-ready PDFs.',
          'Your customer receives a professional document with clear itemization, applicable tax breakdowns, payment terms, and direct UPI payment options.'
        ],
        bulletPoints: [
          'Step 1: Enter your business name, address, and upload your company logo',
          'Step 2: Add customer details, item descriptions, quantity, rates, and discount percentage',
          'Step 3: Click "Download PDF" or "Share on WhatsApp" to deliver your invoice instantly'
        ]
      }
    ],
    faqs: [
      {
        question: 'Do I need to install any software to use this invoice maker?',
        answer: 'No installation required. InvoCentric works directly in your web browser on mobile, tablet, and desktop PC. You can also install it as a lightweight PWA app.'
      },
      {
        question: 'Will my downloaded PDF invoice have an InvoCentric watermark?',
        answer: 'No. InvoCentric never adds watermarks to your customer invoices. Your invoices feature only your company logo and business details.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'Free Invoice Maker', url: 'https://invocentric.in/free-invoice-maker' }
    ],
    ctaText: 'Make a Free Invoice Now',
    ctaSubtext: 'Instant PDF export. No credit card required.',
    relatedPages: [
      { title: 'Invoice Software', slug: 'invoice-software', desc: 'Full-featured small business invoicing' },
      { title: 'GST Invoice Maker', slug: 'gst-invoice-maker', desc: 'GST compliant invoices with HSN codes' },
      { title: 'Quotation Maker', slug: 'quotation-maker', desc: 'Create quotations and convert to invoices' }
    ]
  },

  'gst-billing-software': {
    slug: 'gst-billing-software',
    metaTitle: 'GST Billing Software India | Free GST Accounting App | InvoCentric',
    metaDescription: 'Best free GST billing software in India. Generate GST tax invoices, calculate CGST, SGST & IGST, manage HSN codes, track inventory, and export GSTR reports easily.',
    focusKeyword: 'GST billing software',
    secondaryKeywords: ['GST billing software India', 'GST invoice software', 'GST billing app', 'GST accounting software', 'free GST bill maker'],
    h1: 'Fast, Accurate & Free GST Billing Software for India',
    subtitle: 'Stay 100% GST compliant with automatic CGST, SGST & IGST tax calculations, HSN/SAC directory, state-of-supply auto detection, and audit-ready ledger accounting.',
    badge: '100% Indian GST Compliant • GSTR Ready',
    heroHighlight: 'Auto State-of-Supply • HSN Code Lookup • CGST / SGST / IGST Auto-Split',
    features: [
      {
        title: 'Intelligent Tax Calculation',
        description: 'Auto-detects whether the sale is Intra-State (CGST + SGST) or Inter-State (IGST) based on customer state and seller profile.',
        iconName: 'Calculator'
      },
      {
        title: 'HSN/SAC Code Directory',
        description: 'Built-in directory to search standard HSN codes for electronics, garments, groceries, hardware, pharmacy, and services.',
        iconName: 'Tag'
      },
      {
        title: 'Standard Accounting Compliant Layout',
        description: 'Generate invoices matching official GST structures for seamless collaboration with your Chartered Accountant (CA).',
        iconName: 'FileText'
      },
      {
        title: 'Inventory & Serial Number Tracking',
        description: 'Auto-deduct stock quantities upon bill creation with serial number and lot/batch management.',
        iconName: 'Package'
      }
    ],
    detailedSections: [
      {
        heading: 'Complete GST Invoicing & Accounting for Retailers and Traders',
        content: [
          'GST invoicing in India requires exact tax splits, correct HSN codes, customer GSTIN verification, and amount in words. Mistakes can cause input tax credit (ITC) rejection.',
          'InvoCentric automates all GST calculations so you never have to compute percentages manually. Enter your price and GST rate, and InvoCentric handles subtotal, taxable value, CGST, SGST, IGST, and Grand Total accurately.'
        ],
        bulletPoints: [
          'Real-time GSTIN format validation with state code mapping',
          'Detailed HSN tax summary table at the bottom of every invoice',
          'Support for B2B tax invoices (with customer GSTIN) and B2C retail cash memos',
          'Export monthly sales reports for effortless GSTR-1 and GSTR-3B filing'
        ]
      }
    ],
    faqs: [
      {
        question: 'How does InvoCentric decide between CGST/SGST vs IGST?',
        answer: 'If the customer\'s state matches your business state, InvoCentric automatically applies CGST and SGST equally (50-50). If the customer is in a different state, it applies Integrated GST (IGST).'
      },
      {
        question: 'Can I export my billing data to Excel or Accounting software?',
        answer: 'Yes, InvoCentric provides one-click Excel reports and standard XML ledger exports so your CA can import records directly.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'GST Billing Software', url: 'https://invocentric.in/gst-billing-software' }
    ],
    ctaText: 'Start Free GST Billing',
    ctaSubtext: 'Built for Indian Vyaparis, Retailers & Wholesalers.',
    relatedPages: [
      { title: 'GST Invoice Maker', slug: 'gst-invoice-maker', desc: 'Create individual GST tax bills' },
      { title: 'POS Billing Software', slug: 'pos-billing-software', desc: 'Fast retail counter POS checkout' },
      { title: 'Inventory Management', slug: 'inventory-management', desc: 'Track stock & serial numbers' }
    ]
  },

  'gst-invoice-maker': {
    slug: 'gst-invoice-maker',
    metaTitle: 'GST Invoice Maker Online | Create GST Tax Invoices | InvoCentric',
    metaDescription: 'Generate GST-compliant tax invoices online with InvoCentric. Automatic CGST, SGST, and IGST tax splits, HSN codes, customer GSTIN verification, and instant PDF download.',
    focusKeyword: 'GST invoice maker',
    secondaryKeywords: ['GST invoice generator', 'GST invoice software', 'GST tax invoice', 'GST bill maker', 'online GST invoice generator'],
    h1: 'Online GST Invoice Maker & Tax Bill Generator',
    subtitle: 'Create compliant GST tax invoices for products and services with HSN/SAC codes, reverse charge indicator, place of supply, and payment QR codes.',
    badge: 'Accurate GST Computations • Print Ready',
    heroHighlight: 'B2B & B2C Invoicing • Automatic Tax Split • Thermal & A4 Formats',
    features: [
      {
        title: 'GST Tax Invoices & Bills of Supply',
        description: 'Generate regular GST tax bills for taxable supplies or Bills of Supply for exempt goods and composition dealers.',
        iconName: 'FileText'
      },
      {
        title: 'Customer GSTIN Verification',
        description: 'Auto-validate 15-digit GSTIN formats to ensure ITC eligibility for your B2B customers.',
        iconName: 'Check'
      },
      {
        title: 'Dynamic QR Code Payment',
        description: 'Print dynamic UPI QR codes on bills so clients can pay instantly by scanning with any UPI payment app.',
        iconName: 'QrCode'
      },
      {
        title: 'Multiple Print Layouts',
        description: 'Export in A4 portrait, A5 horizontal, or compact thermal POS receipt layouts.',
        iconName: 'Printer'
      }
    ],
    detailedSections: [
      {
        heading: 'Essential Components of a Valid GST Tax Invoice in India',
        content: [
          'Under the Goods and Services Tax framework in India, an invoice must contain specific mandatory fields to qualify for Input Tax Credit (ITC). InvoCentric ensures every required field is present and formatted correctly.'
        ],
        bulletPoints: [
          'Consecutive serial invoice number (e.g. INV-2026-0001)',
          'Date of issue and due date of payment',
          'Name, address, and GSTIN of the supplier and recipient',
          'Harmonized System of Nomenclature (HSN) or Service Accounting Code (SAC)',
          'Taxable value, GST rate percentage, and split CGST / SGST / IGST amounts',
          'Total invoice value formatted in numerical figures and words (Rupees in words)'
        ]
      }
    ],
    faqs: [
      {
        question: 'What is the difference between a Tax Invoice and a Bill of Supply?',
        answer: 'A Tax Invoice is issued by regular GST-registered businesses when charging GST on goods or services. A Bill of Supply is issued when selling exempt goods or by businesses registered under the GST Composition Scheme where tax cannot be charged.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'GST Invoice Maker', url: 'https://invocentric.in/gst-invoice-maker' }
    ],
    ctaText: 'Generate GST Invoice Online',
    ctaSubtext: 'Free forever. Ready in under 1 minute.',
    relatedPages: [
      { title: 'GST Billing Software', slug: 'gst-billing-software', desc: 'Complete GST software for businesses' },
      { title: 'Free Invoice Maker', slug: 'free-invoice-maker', desc: 'Simple non-GST invoice generator' },
      { title: 'POS Billing Software', slug: 'pos-billing-software', desc: 'Point of sale counter billing' }
    ]
  },

  'billing-software': {
    slug: 'billing-software',
    metaTitle: 'Billing Software for Small Businesses India | InvoCentric',
    metaDescription: 'All-in-one business billing software for Indian retail shops, traders, and small businesses. Invoicing, inventory, POS, customer ledger, and barcode scanning in one free app.',
    focusKeyword: 'billing software',
    secondaryKeywords: ['billing software India', 'business billing software', 'small business billing software', 'online billing software', 'retail billing software'],
    h1: 'All-in-One Billing Software for Small Businesses',
    subtitle: 'Streamline sales, customer credit (Khata), stock control, and daily cash transactions with modern, lightweight billing software designed for speed.',
    badge: 'Desktop & Mobile Ready • Offline First',
    heroHighlight: 'Sales Billing • Customer Ledgers • Stock Control • Daily Book',
    features: [
      {
        title: 'Quick Counter Sales',
        description: 'Fast billing interface with barcode scanner support to checkout customers in seconds during peak business hours.',
        iconName: 'Store'
      },
      {
        title: 'Customer Khata & Statements',
        description: 'Track outstanding balances, send 1-click WhatsApp payment reminders, and download party ledger statements.',
        iconName: 'Users'
      },
      {
        title: 'Daily Cash Book Ledger',
        description: 'Record daily cash in/out transactions, monitor operating expenses, and understand net daily profits.',
        iconName: 'TrendingUp'
      },
      {
        title: 'Data Privacy & Local Backup',
        description: 'Your business data stays safely encrypted on your device with optional real-time cloud backup.',
        iconName: 'ShieldCheck'
      }
    ],
    detailedSections: [
      {
        heading: 'Why Small Businesses in India Choose InvoCentric Billing Software',
        content: [
          'From local Kirana stores and mobile repair shops to wholesale traders and service providers, businesses need a billing tool that is fast, works offline, and requires zero technical training.',
          'InvoCentric eliminates bookkeeping chaos by bringing invoicing, barcode scanning, stock tracking, and payment collection into a single unified dashboard.'
        ],
        bulletPoints: [
          'Fast search across thousands of products by name, category, or barcode',
          'Direct smartphone camera and USB barcode gun support for instant scanning',
          'Automatic low stock alerts to prevent running out of bestselling items',
          'Customizable quotation maker that converts to invoice with 1 click'
        ]
      }
    ],
    faqs: [
      {
        question: 'Can I use InvoCentric on both mobile and PC?',
        answer: 'Yes. InvoCentric runs seamlessly on Android, iPhone, Windows PC, Mac, and Linux laptops via any web browser.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'Billing Software', url: 'https://invocentric.in/billing-software' }
    ],
    ctaText: 'Start Using InvoCentric Free',
    ctaSubtext: 'Join thousands of businesses managing billing with ease.',
    relatedPages: [
      { title: 'POS Billing Software', slug: 'pos-billing-software', desc: 'Fast retail checkout & thermal bills' },
      { title: 'Inventory Management', slug: 'inventory-management', desc: 'Stock tracking & low stock alerts' },
      { title: 'Ledger Software', slug: 'ledger-software', desc: 'Customer & supplier khata book' }
    ]
  },

  'pos-billing-software': {
    slug: 'pos-billing-software',
    metaTitle: 'POS Billing Software India | Fast Retail POS App | InvoCentric',
    metaDescription: 'Lightning fast POS billing software for retail shops, supermarkets, and Kirana stores in India. Barcode scanning, thermal receipt printing, and quick cash/UPI checkout.',
    focusKeyword: 'POS billing software',
    secondaryKeywords: ['POS billing system', 'POS billing app', 'retail POS software', 'shop billing software', 'thermal print bill software'],
    h1: 'Lightning Fast Retail POS Billing Software',
    subtitle: 'Speed up checkout counter queues with high-speed barcode scanning, touch-friendly item grid, thermal receipt printing, and instant UPI QR payments.',
    badge: 'Quick Checkout POS • Thermal Printer Ready',
    heroHighlight: 'USB & Camera Barcode Scan • 2-Inch / 3-Inch Thermal Receipts • Cash & UPI Payments',
    features: [
      {
        title: 'High-Speed Barcode Checkout',
        description: 'Scan product barcodes using your phone camera or USB barcode scanner to add items to the cart in milliseconds.',
        iconName: 'Barcode'
      },
      {
        title: 'Thermal Receipt Printing',
        description: 'Optimized formatting for 2-inch (58mm) and 3-inch (80mm) ESC/POS thermal printers via USB and Bluetooth.',
        iconName: 'Printer'
      },
      {
        title: 'Split & Digital Payments',
        description: 'Accept Cash, UPI, Credit Card, or credit to customer account with automated change calculation.',
        iconName: 'Receipt'
      },
      {
        title: 'Live Stock Auto-Deduction',
        description: 'Inventory levels reduce automatically with every completed transaction to ensure accurate live stock figures.',
        iconName: 'Package'
      }
    ],
    detailedSections: [
      {
        heading: 'Designed for High-Volume Retail Counters in India',
        content: [
          'During busy evening rush hours, slow billing software leads to lost customers. InvoCentric Quick POS is engineered for minimum keystrokes and instant bill completion.',
          'Simply scan the barcode, enter quantity, and tap Print. The thermal receipt generates instantly while your inventory updates in the background.'
        ],
        bulletPoints: [
          'Keyboard shortcut support for rapid numeric entry and instant print',
          'Hold and resume carts for customers who need to pick additional items',
          'Support for serial number and batch warranty tracking at checkout',
          'Daily register closure report summarizing total cash, UPI, and credit sales'
        ]
      }
    ],
    faqs: [
      {
        question: 'Which thermal printers are compatible with InvoCentric POS?',
        answer: 'InvoCentric is compatible with all standard thermal printers including TVS, Xprinter, Epson, Posiflex, Everycom, NGX, and standard Bluetooth receipt printers.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'POS Billing Software', url: 'https://invocentric.in/pos-billing-software' }
    ],
    ctaText: 'Launch Quick POS Counter',
    ctaSubtext: 'Free retail POS with instant thermal receipt generation.',
    relatedPages: [
      { title: 'Barcode Billing', slug: 'barcode-billing', desc: 'Scan & generate product barcodes' },
      { title: 'Billing Software', slug: 'billing-software', desc: 'Complete business billing suite' },
      { title: 'Inventory Management', slug: 'inventory-management', desc: 'Manage catalog and live stock' }
    ]
  },

  'barcode-billing': {
    slug: 'barcode-billing',
    metaTitle: 'Barcode Billing Software & Scanner App | InvoCentric',
    metaDescription: 'Free barcode billing software with smartphone camera and USB barcode gun support. Generate custom barcode labels, print sticker sheets, and bill items in seconds.',
    focusKeyword: 'barcode billing software',
    secondaryKeywords: ['barcode billing system', 'barcode scanner billing', 'barcode inventory software', 'retail barcode billing', 'barcode generator'],
    h1: 'Barcode Billing Software & Product Label Generator',
    subtitle: 'Equip your retail shop with professional barcode scanning and sticker printing. Scan with any phone camera or USB gun, and print labels on A4 sticker sheets or thermal rolls.',
    badge: 'Scan & Generate Barcodes • Zero Hardware Cost',
    heroHighlight: 'Phone Camera Scanning • USB Gun Ready • A4 24/65-in-1 Sticker Printing',
    features: [
      {
        title: 'Zero-Hardware Camera Scanner',
        description: 'Turn any smartphone camera into a high-speed laser-quality barcode scanner without buying expensive hardware.',
        iconName: 'Smartphone'
      },
      {
        title: 'USB Barcode Gun Compatibility',
        description: 'Plug any standard USB barcode scanner gun into your laptop or PC for high-volume counter operations.',
        iconName: 'Barcode'
      },
      {
        title: 'Barcode Label Sticker Printing',
        description: 'Generate and print custom barcode stickers for products on A4 sheets (24-in-1, 65-in-1) or thermal sticker rolls.',
        iconName: 'Printer'
      },
      {
        title: 'Format Support (EAN-13, CODE128)',
        description: 'Support for EAN-13, EAN-8, UPC, CODE128, CODE39, and ITF-14 barcode standards with validation.',
        iconName: 'Tag'
      }
    ],
    detailedSections: [
      {
        heading: 'How Barcode Billing Transforms Your Retail Business',
        content: [
          'Barcode billing eliminates manual pricing errors, speeds up checkout by 5x, and ensures that item sales deduct the exact variant from your inventory database.',
          'With InvoCentric, you can generate custom barcodes for unbranded products, print sticker labels, and scan them at checkout effortlessly.'
        ],
        bulletPoints: [
          'Assign unique barcodes or auto-generate EAN-13 codes with valid checksums',
          'Print stickers with Store Name, Product Description, Selling Price, and MRP',
          'Global phone scanner feature: scan barcodes with your mobile to auto-type into your PC bill',
          'Track serial numbers for electronics, mobile phones, and warranty items'
        ]
      }
    ],
    faqs: [
      {
        question: 'Can I print barcode stickers on regular A4 sticker paper?',
        answer: 'Yes. InvoCentric includes exact millimeter layout presets for standard A4 24-in-1 (3x8) and 65-in-1 (5x13) pre-cut sticker sheets.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'Barcode Billing', url: 'https://invocentric.in/barcode-billing' }
    ],
    ctaText: 'Open Barcode Studio Free',
    ctaSubtext: 'Generate and print barcodes with zero setup fees.',
    relatedPages: [
      { title: 'POS Billing Software', slug: 'pos-billing-software', desc: 'Fast retail POS checkout counter' },
      { title: 'Inventory Management', slug: 'inventory-management', desc: 'Track products & stock levels' },
      { title: 'GST Billing Software', slug: 'gst-billing-software', desc: 'Compliant GST tax bills' }
    ]
  },

  'inventory-management': {
    slug: 'inventory-management',
    metaTitle: 'Inventory Management Software India | Free Stock Control | InvoCentric',
    metaDescription: 'Free inventory management software for small businesses in India. Track live stock, manage serial numbers, lot/batch expiry alerts, low stock warnings, and stock adjustments.',
    focusKeyword: 'inventory management software',
    secondaryKeywords: ['stock management software', 'inventory software', 'stock management app', 'inventory billing software', 'product inventory software'],
    h1: 'Real-Time Inventory & Stock Management Software',
    subtitle: 'Keep accurate control over your product catalog, warehouse stock, serial numbers, batch expiry dates, and low stock reorder thresholds.',
    badge: 'Live Stock Control • Serial & Batch Tracking',
    heroHighlight: 'Auto Stock Deduction • Expiry Date Alerts • Low Stock Warnings • Bulk Excel Upload',
    features: [
      {
        title: 'Automated Live Stock Sync',
        description: 'Stock deducts automatically when invoices or POS receipts are generated, and increments when purchase bills are added.',
        iconName: 'RefreshCw'
      },
      {
        title: 'Serial Number & IMEI Tracking',
        description: 'Track individual serial numbers and device IMEIs from purchase to sale for electronics and warranty items.',
        iconName: 'Barcode'
      },
      {
        title: 'Lot / Batch & Expiry Alerts',
        description: 'Monitor batch numbers and manufacturing/expiry dates for food, FMCG, and pharmaceutical products.',
        iconName: 'AlertCircle'
      },
      {
        title: 'Low Stock Alerts',
        description: 'Set minimum stock thresholds per item and receive proactive alerts before running out of high-demand goods.',
        iconName: 'TrendingDown'
      }
    ],
    detailedSections: [
      {
        heading: 'Complete Stock Visibility from Purchase to Sale',
        content: [
          'Poor inventory management leads to stockouts, expired goods, and untracked losses. InvoCentric gives you full visibility over your stock quantities, purchase costs, and profit margins in real-time.',
          'Import your entire product list in seconds using Excel / CSV spreadsheets, organize items by categories, and adjust stock counts with audit logs.'
        ],
        bulletPoints: [
          'Bulk item import and export with Excel compatibility',
          'AI Bill Scan: Snap photo of supplier purchase bills to auto-update stock without manual typing',
          'Stock adjustment logs recording reasons for damages, shrinkage, or returns',
          'Gross profit and margin calculation per product category'
        ]
      }
    ],
    faqs: [
      {
        question: 'Can I import my existing product list from Excel?',
        answer: 'Yes. InvoCentric allows you to import hundreds of items with names, prices, HSN codes, opening stock, and barcodes in one click using CSV or Excel.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'Inventory Management', url: 'https://invocentric.in/inventory-management' }
    ],
    ctaText: 'Manage Inventory Free',
    ctaSubtext: 'Track stock, serials, and batches in one place.',
    relatedPages: [
      { title: 'Barcode Billing', slug: 'barcode-billing', desc: 'Scan and generate product barcodes' },
      { title: 'GST Billing Software', slug: 'gst-billing-software', desc: 'Auto stock sync with GST bills' },
      { title: 'POS Billing Software', slug: 'pos-billing-software', desc: 'Quick counter billing POS' }
    ]
  },

  'ledger-software': {
    slug: 'ledger-software',
    metaTitle: 'Customer & Supplier Ledger Software | Digital Khata Book | InvoCentric',
    metaDescription: 'Manage customer credit (Udhaar), supplier balances, payment receipts, and daily cash transactions with InvoCentric digital ledger software.',
    focusKeyword: 'ledger software',
    secondaryKeywords: ['customer ledger', 'supplier ledger', 'digital khata book', 'bahi khata software', 'cash book ledger'],
    h1: 'Digital Customer & Supplier Ledger (Khata Book) Software',
    subtitle: 'Say goodbye to paper bahi-khata books. Track customer credit balances, record payment receipts, send 1-click WhatsApp payment reminders, and settle supplier dues.',
    badge: 'Digital Khata • 1-Click WhatsApp Payment Reminders',
    heroHighlight: 'Customer Balance Tracking • WhatsApp Reminders with UPI Link • Party Statements PDF',
    features: [
      {
        title: 'Customer Party Ledgers',
        description: 'Maintain detailed debit/credit logs for every customer with running balance calculations.',
        iconName: 'Users'
      },
      {
        title: '1-Click WhatsApp Reminders',
        description: 'Send polite payment reminder messages on WhatsApp with customer pending total and your UPI payment link.',
        iconName: 'Smartphone'
      },
      {
        title: 'Supplier Purchase Ledgers',
        description: 'Track how much you owe to your wholesale distributors and vendors for seamless account reconciliations.',
        iconName: 'Store'
      },
      {
        title: 'Detailed Statement PDFs',
        description: 'Generate date-filtered party statement summaries in PDF to share with clients for reconciliation.',
        iconName: 'FileText'
      }
    ],
    detailedSections: [
      {
        heading: 'Collect Customer Outstanding Balances 3x Faster',
        content: [
          'Managing customer credit on manual notebooks often leads to forgotten balances, disputes, and delayed cash flows.',
          'InvoCentric links every invoice and payment entry directly to the party profile, maintaining an unalterable audit trail that can be verified by both parties.'
        ],
        bulletPoints: [
          'Automatic invoice linking to customer balance when bills are saved as Unpaid or Partial',
          'Record partial payments with payment method (Cash, UPI, Bank Transfer, Cheque)',
          'Advance payment adjustment directly in fresh invoice creation',
          'Download professional Customer Statement of Account with company letterhead'
        ]
      }
    ],
    faqs: [
      {
        question: 'Can I send payment reminders to customers on WhatsApp?',
        answer: 'Yes! From the Customers page, tap the WhatsApp icon to generate a customized reminder message containing the exact pending amount and your business UPI payment link.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'Ledger Software', url: 'https://invocentric.in/ledger-software' }
    ],
    ctaText: 'Open Digital Khata Ledger',
    ctaSubtext: 'Track customer balances and collect dues faster.',
    relatedPages: [
      { title: 'Billing Software', slug: 'billing-software', desc: 'Complete sales & billing dashboard' },
      { title: 'Invoice Software', slug: 'invoice-software', desc: 'Create professional invoices' },
      { title: 'GST Billing Software', slug: 'gst-billing-software', desc: 'GST compliant accounting' }
    ]
  },

  'quotation-maker': {
    slug: 'quotation-maker',
    metaTitle: 'Free Quotation Maker & Estimate Generator | InvoCentric',
    metaDescription: 'Create professional business quotations, estimates, and proposals online. 1-click convert quotation to GST invoice with InvoCentric free quotation maker.',
    focusKeyword: 'quotation maker',
    secondaryKeywords: ['estimate generator', 'free quotation maker', 'online estimate maker', 'proposal generator', 'quote to invoice converter'],
    h1: 'Free Business Quotation & Estimate Maker Online',
    subtitle: 'Draft professional sales quotations and price estimates for clients. Send via WhatsApp or PDF, and convert accepted quotes into tax invoices with 1 click.',
    badge: '1-Click Convert Quote to Invoice • Professional Templates',
    heroHighlight: 'Custom Validity Dates • Terms & Conditions • 1-Click Invoice Conversion',
    features: [
      {
        title: 'Professional Price Estimates',
        description: 'Present clean, beautifully formatted quotes that impress clients and win more business contracts.',
        iconName: 'FileText'
      },
      {
        title: '1-Click Invoice Conversion',
        description: 'When your customer approves the quote, click "Convert to Invoice" to auto-populate all items, client details, and taxes.',
        iconName: 'RefreshCw'
      },
      {
        title: 'Custom Terms & Validity',
        description: 'Set estimate expiry dates, delivery timelines, payment schedules, and custom terms and conditions.',
        iconName: 'Check'
      },
      {
        title: 'WhatsApp & PDF Sharing',
        description: 'Deliver quotes instantly to client smartphones with PDF download and direct messaging.',
        iconName: 'Smartphone'
      }
    ],
    detailedSections: [
      {
        heading: 'Speed Up Sales with Seamless Quote-to-Invoice Workflow',
        content: [
          'Writing quotations on paper or basic spreadsheets causes delays and requires duplicate data entry when the client accepts.',
          'InvoCentric allows you to draft detailed estimates with discounts, tax rates, and notes. When accepted, a single tap converts the quotation into an active invoice without re-typing.'
        ],
        bulletPoints: [
          'Add item descriptions, size/dimensions, quantity, unit rates, and discount percentage',
          'Track quotation status (Draft, Sent, Accepted, Converted, Expired)',
          'Convert directly to full GST Invoice with auto-populated client profile and product lines',
          'Export in clean corporate PDF layouts'
        ]
      }
    ],
    faqs: [
      {
        question: 'Can I convert an estimate into an invoice without re-entering items?',
        answer: 'Yes! In the Quotations dashboard, tap "Convert to Invoice" on any quote. It automatically opens the Create Invoice screen with the customer, items, prices, and terms pre-filled.'
      }
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://invocentric.in/' },
      { name: 'Quotation Maker', url: 'https://invocentric.in/quotation-maker' }
    ],
    ctaText: 'Create a Quotation Now',
    ctaSubtext: 'Free estimate maker with instant invoice conversion.',
    relatedPages: [
      { title: 'Invoice Software', slug: 'invoice-software', desc: 'Create and manage sales invoices' },
      { title: 'Free Invoice Maker', slug: 'free-invoice-maker', desc: 'Simple PDF invoice creator' },
      { title: 'Billing Software', slug: 'billing-software', desc: 'Complete business billing suite' }
    ]
  }
};
