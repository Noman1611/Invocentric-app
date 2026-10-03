# InvoCentric — Complete UI/UX Specification & Blueprint
> **Purpose**: This document provides an exhaustive, screen-by-screen, component-level UI/UX specification for designing and building a brand-new, modern UI for InvoCentric across **Android Mobile App**, **Windows Desktop Software**, and **Responsive Web App**.

---

## 1. Product Identity & Design Principles

### 1.1 Core Value Proposition
InvoCentric is a high-speed, offline-first GST Billing, POS, Inventory, and Business Accounting platform engineered for Indian SMBs (Retailers, Wholesalers, Distributors, Mobile & Electronics stores, and Service Providers).

### 1.2 Multi-Platform Target Environments
| Platform | Form Factor | Primary Interaction | Key UI Constraints |
|---|---|---|---|
| **Android Mobile APK** | Smartphones (320px – 414px) | One-handed thumb touch, Camera barcode scanning, WhatsApp sharing | Safe-area padding (`env(safe-area-inset)`), bottom navigation, sticky thumb-zone checkout bars, zero horizontal overflow |
| **Windows Desktop** | Monitors (1024px – 1920px+) | Mouse, physical barcode scanners, full keyboard shortcuts (F1-F12) | Dense data tables, collapsible sidebar, multi-window modals, thermal/A4 print dialogs |
| **Tablet / iPad** | 768px – 1024px | Touch & Keyboard dock | Split master-detail panes, adaptable 2-column forms |

### 1.3 Key UI Design Tenets
1. **Zero Viewport Overflow**: No horizontal scrolling on the page body. Every screen adapts cleanly from 320px to 4K displays.
2. **Speed & Minimal Clicks**: Create an invoice or POS sale in under 3 taps/clicks.
3. **High Information Density with Visual Breathing Room**: Clean whitespace, subtle borders, card elevation, and scannable tabular typography.
4. **Dual Data Presentation**: Dense tabular view on Desktop (`hidden md:block`) automatically reflowing to touch cards on Mobile (`block md:hidden`).
5. **Hardware & Offline Awareness**: Prominent indicators for Cloud vs. Local storage mode, sync queue, thermal printer connectivity, and barcode scanner state.

---

## 2. Design System & Design Tokens

### 2.1 Color Palette

#### Primary & Brand Accents
| Token | Light Mode HEX | Dark Mode HEX | Usage |
|---|---|---|---|
| `primary-50` | `#ECFDF5` | `#064E3B` | Soft badges, active nav backgrounds |
| `primary-100` | `#D1FAE5` | `#065F46` | Chip hover, table row highlight |
| `primary-500` | `#10B981` | `#10B981` | Vibrant Emerald brand accent |
| `primary-600` | `#059669` | `#059669` | Primary action buttons, active toggles |
| `primary-700` | `#047857` | `#34D399` | Button active/pressed states |
| `brand-gradient`| `linear-gradient(135deg, #059669, #0D9488)` | Same with glowing opacity | Header banners, Pro upgrade badges |

#### Neutral & Background Surfaces
| Token | Light Mode HEX | Dark Mode HEX | Usage |
|---|---|---|---|
| `bg-app` | `#F8FAFC` (Slate 50) | `#0B0F19` (Deep Navy Black) | App main viewport background |
| `bg-surface` | `#FFFFFF` | `#111827` (Gray 900) | Cards, modals, sidebars, sheets |
| `bg-surface-elevated` | `#F1F5F9` | `#1F2937` (Gray 800) | Secondary panels, drawer headers, dropdowns |
| `border-subtle` | `#E2E8F0` (Slate 200) | `#374151` (Gray 700) | Card dividers, input borders |
| `border-focus` | `#10B981` | `#34D399` | Input focus ring (`ring-2 ring-primary-500`) |

#### Text & Typography
| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `text-primary` | `#0F172A` (Slate 900) | `#F9FAFB` (Gray 50) | Page titles, invoice totals, customer names |
| `text-secondary` | `#475569` (Slate 600) | `#9CA3AF` (Gray 400) | Subtitles, table headers, labels |
| `text-muted` | `#94A3B8` (Slate 400) | `#6B7280` (Gray 500) | Timestamp, helper text, empty states |

#### Semantic Status Tokens
| State | Light Mode Background | Light Mode Text | Dark Mode Equivalent |
|---|---|---|---|
| **Success / Paid** | `#DEF7EC` | `#03543F` | `bg-emerald-950/50 text-emerald-400 border-emerald-800` |
| **Warning / Partial** | `#FEF08A` | `#713F12` | `bg-amber-950/50 text-amber-400 border-amber-800` |
| **Danger / Unpaid / Overdue** | `#FDE8E8` | `#9B1C1C` | `bg-rose-950/50 text-rose-400 border-rose-800` |
| **Info / Draft** | `#E1EFFE` | `#1E429F` | `bg-blue-950/50 text-blue-400 border-blue-800` |

### 2.2 Typography Scale
- **Display / Hero**: `32px` (2rem), Bold (700), Line-height 1.2 — Dashboard net sales, Hero banner
- **Heading 1**: `24px` (1.5rem), SemiBold (600), Line-height 1.3 — Page titles
- **Heading 2**: `20px` (1.25rem), SemiBold (600), Line-height 1.35 — Section titles, Modal headers
- **Heading 3 / Subhead**: `16px` (1rem), Medium (500) — Card headers, Metric labels
- **Body / Standard**: `14px` (0.875rem), Regular (400), Line-height 1.5 — Table content, inputs, descriptions
- **Small / Metadata**: `12px` (0.75rem), Medium (500) — Badges, tax percentages, timestamps
- **Micro / Tag**: `10px` (0.625rem), Bold (700), Tracking-wide — Status pills, shortcut hints (e.g. `[Ctrl+P]`)

### 2.3 Spacing, Borders & Shadows
- **Card Radius**: `rounded-2xl` (`16px`) for modern soft look; `rounded-3xl` (`24px`) for mobile bottom sheets.
- **Button Radius**: `rounded-xl` (`12px`) for primary touch CTA buttons; `rounded-lg` (`8px`) for compact table action chips.
- **Touch Targets**: Minimum `44px × 44px` (or `48px` height for full-width mobile CTA buttons).
- **Elevation Shadows**:
  - `shadow-sm`: Flat cards, input fields
  - `shadow-md`: Hovered cards, floating quick filters
  - `shadow-xl`: Dropdown menus, popovers
  - `shadow-2xl`: Modals, mobile bottom sheets, sticky bottom action bars

---

## 3. Global Layout Shell & Navigation Hierarchy

### 3.1 Desktop Layout (`>= 1024px`)
```
+----------------------------------------------------------------------------------------------------+
| SIDEBAR (w-64)            | TOP HEADER BAR (h-16 sticky top-0)                                    |
| [Logo] InvoCentric        | [Search Omnibox] [Storage Mode] [Cloud Sync] [Shortcuts] [Profile/Pro] |
| ------------------------- +------------------------------------------------------------------------+
| - Dashboard               | MAIN CONTENT VIEWPORT (overflow-y-auto max-w-7xl mx-auto p-6)          |
| - Quick POS [F2]          |                                                                        |
| - Invoices (Sales)        |  [Page Header: Title + Primary Action Buttons]                         |
| - Quotations (Estimates)  |  [KPI Metrics Grid / Filter Bar]                                       |
| - Items & Inventory       |  [Dense Data Table / Dynamic Content Panes]                            |
| - Purchases (Expenses)    |                                                                        |
| - Customers (Khata)       |                                                                        |
| - DailyBook (Cash)        |                                                                        |
| - Reports & Tax (GST)     |                                                                        |
| - Barcode & Labels        |                                                                        |
| - Accounting Export       |                                                                        |
| ------------------------- |                                                                        |
| - Settings                |                                                                        |
| [v1.0.38 / Cloud Indicator]|                                                                       |
+----------------------------------------------------------------------------------------------------+
```

### 3.2 Mobile App Layout (`< 768px`)
```
+--------------------------------------------------------+
| TOP APP BAR (h-14 sticky top-0 bg-surface/90 blur)     |
| [Company Logo / Name]         [Search] [Sync] [Profile]|
+--------------------------------------------------------+
| MAIN SCROLLABLE VIEWPORT (pb-28 pb-safe px-3 py-4)     |
|                                                        |
| [Metric Quick Carousel / Action Quick Chips]           |
| [Filter & Search Input Bar]                            |
| [Touch-Friendly Card Stack: 100% width]                |
|                                                        |
+--------------------------------------------------------+
| STICKY BOTTOM ACTION BAR (Optional on forms: h-16)     |
| [Total: ₹1,450.00]      [Pay / Save Invoice Button CTA]|
+--------------------------------------------------------+
| MOBILE BOTTOM NAVIGATION BAR (h-16 fixed bottom-0)     |
| [Dashboard] [POS] [Invoices] [Items] [More Menu (☰)]   |
+--------------------------------------------------------+
```

---

## 4. Screen-by-Screen UI Specifications

### 4.1 Authentication & Onboarding
#### Screen: Login & Sign Up (`LoginPage.tsx`)
- **Visual Style**: Clean split-pane layout on desktop; vertical center-card on mobile with animated gradient aura background.
- **Header Elements**: InvoCentric SVG Logo, App Name, Tagline ("Simple • Secure • Reliable GST Billing").
- **Google Sign-In**:
  - Official Google Brand Button (`Sign in with Google`) with Google 'G' icon.
  - On click: In-button loading spinner.
  - No technical modal or diagrams shown to end users.
  - Deep-link return support for Android APK (`invocentric://auth?session=...`).
- **Email/Password Form**:
  - Floating label email and password inputs with password eye-toggle.
  - Remember me checkbox + "Forgot password?" link.
  - Primary button: "Sign In / Create Account".
- **Footer**: Privacy Policy & Terms of Service links.

#### Screen: Setup Wizard & Onboarding (`SetupWizard.tsx`, `OnboardingGuide.tsx`)
- **Progress Tracker**: 3-step numbered stepper (1. Business Info → 2. Tax & Bank Setup → 3. Print Template).
- **Step 1 (Business Info)**: Business Name, Trade Name, Phone number, Email, State dropdown (auto-fills state code for GST).
- **Step 2 (Tax & Bank)**: GSTIN (with auto-verify button), Composite vs Regular GST toggle, Bank Name, Account Number, IFSC, UPI ID.
- **Step 3 (Template)**: Preview thumbnail carousel of Invoice Templates (Thermal 58mm/80mm, Classic A4, Modern Teal, Minimalist).
- **Finish Button**: "Launch InvoCentric".

---

### 4.2 Dashboard (`Dashboard.tsx`)
- **Header**: Greeting ("Hello, [Business Name]"), Date range selector (Today, This Week, This Month, FY 2026-27), "New Sale (+)" Quick Button.
- **Top Metrics Grid (4 KPI Cards)**:
  1. **Total Sales / Revenue**: Amount in ₹, percentage change badge (+14%), sales count.
  2. **Total Received / Cash Flow**: Amount collected via Cash / UPI / Bank.
  3. **Total Outstanding / Receivables**: Amount due from customers, overdue count in red.
  4. **Low Stock Alert**: Number of products below threshold with one-tap restock shortcut.
- **Analytics Chart**: Interactive bar/area chart of 30-day sales vs collections.
- **Quick POS / Quick Actions Bar**: Horizontal scrollable action pills on mobile:
  - `[+ Quick POS]` `[+ GST Invoice]` `[+ Add Item]` `[+ Cash In/Out]` `[WhatsApp Reminder]`
- **Recent Transactions Reflow**:
  - **Desktop**: Table with Columns (Invoice #, Date, Customer Name, Payment Mode, Total, Status, Action).
  - **Mobile**: Touch cards with Customer Name, Invoice # badge, Date, Amount (Green for Paid, Red for Unpaid), and WhatsApp/View icon buttons.

---

### 4.3 Quick POS Billing (`QuickPOS.tsx`)
- **Purpose**: High-speed touch checkout for retail counters, grocery, apparel, and hardware stores.
- **Layout**:
  - **Desktop**: 2-Column Split: Left side = Item Search + Category Pills + Product Grid (65%); Right side = Persistent Cart & Checkout Panel (35%).
  - **Mobile**: Full-screen Product Grid with sticky bottom cart summary pill (`[Cart: 3 Items • ₹650] [View Cart →]`).
- **Search & Scanner Header**:
  - Barcode search input with auto-focus.
  - Camera Barcode Scanner trigger icon button (opens live camera viewfinder).
  - Voice / Quick search bar.
- **Category Filter Pills**: Horizontal scrollable chips (`All`, `Groceries`, `Beverages`, `Electronics`, etc.).
- **Product Touch Card**:
  - Item name, SKU / Barcode, Selling Price (₹), Stock badge (e.g. `Stock: 42`).
  - One-tap add to cart with subtle bounce micro-animation (`active:scale-95`).
- **Cart Panel / Mobile Bottom Sheet**:
  - Customer selection input with quick "+ Add Customer" modal.
  - Cart item list: Item title, unit price, quantity touch steppers (`[-]` `[Qty: 2]` `[+]`), line total, remove `[✕]`.
  - Discount input (% or flat ₹).
  - Multi-tax calculation summary (Taxable Value, CGST, SGST, Cess, Round Off, Final Total).
  - Payment Mode Selector (Cash, UPI / QR, Card, Credit / Khata).
  - Large Primary CTA Button: `[Pay & Print Invoice (F12)]` with thermal print auto-trigger.

---

### 4.4 Create Invoice & Billing Editor (`CreateInvoice.tsx`)
- **Header**: Invoice Title, Invoice Number (`INV-2026-0001` auto-generated), Date Picker, Due Date.
- **Customer Section**:
  - Searchable autocomplete dropdown for existing customers.
  - Quick inline fields: Phone number, GSTIN, Billing Address, Place of Supply.
- **Line Items Section**:
  - **Desktop View**: Multi-column editable grid:
    - `Item Name / Barcode` | `HSN Code` | `Qty` | `Unit (Pcs/Kg)` | `Rate (₹)` | `Discount` | `GST %` | `Total (₹)` | `Actions`
  - **Mobile Card Reflow**:
    - Each item is an individual card with expandable drawer.
    - Fields: Title, Qty stepper, Rate, Tax badge, Total.
    - Button to attach Serial / IMEI numbers via bottom sheet.
  - "+ Add Item Row" button & "+ Scan Barcode" button.
- **Bottom Summary & Tax Calculation Engine**:
  - Subtotal, Item discounts, Additional Discount.
  - Automatic Intra-State (CGST + SGST) vs Inter-State (IGST) detection based on Place of Supply.
  - Shipping & Packaging charges.
  - Round off (Automatic ₹0.xx round to nearest whole rupee).
  - **Advance Received** input & **Balance Due** auto-computation.
- **Terms & Notes**: Editable notes, bank account selection for payment QR code display.
- **Sticky Bottom Action Bar**:
  - Total Display: `Total: ₹12,450 | Balance: ₹2,450`
  - Action Buttons: `[Save Draft]` `[Save & Share WhatsApp]` `[Save & Print Invoice]`

---

### 4.5 Invoices Management (`Invoices.tsx`)
- **Filter Tabs**: `All (142)`, `Paid (110)`, `Unpaid (22)`, `Overdue (10)`.
- **Date & Search Filter**: Date range picker (Custom, Last 7 Days, Month), Customer search, Invoice number search.
- **Desktop Table vs. Mobile Cards**:
  - **Mobile Card View**:
    - Header: `INV-0042` (Bold) • `24 Oct 2026` • Status Badge (`PAID` in green / `UNPAID` in red).
    - Body: Customer Name (Bold), Phone number, Items summary (`3 Items`).
    - Footer: Total Amount (`₹4,890.00`), Balance Due.
    - Action Icons: `[PDF Download]` `[Print]` `[WhatsApp Share]` `[More (Edit/Delete)]`.

---

### 4.6 Invoice View & Print Engine (`InvoiceView.tsx`)
- **Preview Modes**:
  - **Thermal Receipt (58mm / 2-inch)**: Compact roll layout, store name, itemized table, total, UPI QR code.
  - **Thermal Receipt (80mm / 3-inch)**: Standard POS printer layout.
  - **A4 / A5 Full Sheet**: Corporate GST invoice layout with tax break-up table, HSN summary, bank details, terms, authorized signature box.
  - **Modern Teal / Classic Minimal / Clean Gradient** visual themes.
- **Top Action Bar**:
  - `[Print (Ctrl+P)]` (direct browser print dialog)
  - `[Download PDF]`
  - `[WhatsApp Share]` (opens dynamic pre-filled WhatsApp message)
  - `[Edit Invoice]`
  - `[Convert / Duplicate]`

---

### 4.7 Quotations & Estimates (`Quotations.tsx`)
- **Purpose**: Send non-billing estimates / proforma quotes to clients.
- **Key Features**:
  - Expiry Date indicator (e.g. "Valid till 15 Nov").
  - Status Pills: `Draft`, `Sent`, `Approved`, `Converted`.
  - **1-Click Conversion Action**: `[Convert to Invoice]` button instantly transfers all customer and line item data to `CreateInvoice.tsx` without re-entry.

---

### 4.8 Items & Inventory Hub (`Items.tsx`)
- **6 Sub-Tabs**:
  1. **Products Catalog**: Complete list of products, images, categories, MRP, Selling Price, Cost Price, Current Stock.
  2. **Stock In/Out Tracker**: Stock adjustment log (Stock In, Stock Out, Reason / Damage / Physical verification).
  3. **Serial & IMEI Number Registry**: Search individual serial numbers to trace which invoice/customer they were sold to.
  4. **Low Stock Alerts**: Filter for items at or below reorder level; one-tap purchase order generator.
  5. **Batch & Expiry Tracker**: For FMCG & Pharmaceuticals: Batch Number, Manufacturing Date, Expiry countdown tags (`Expires in 15 days`).
  6. **Categories & Brands**: Category organization with color tagging.
- **Item Creation / Edit Modal**:
  - Item Type (Product vs Service).
  - Name, SKU, Barcode, HSN/SAC Code.
  - Unit of Measurement (Pcs, Box, Kg, Liter, Meter, etc.).
  - Pricing: Purchase Price (excluding/including tax), Markup %, Selling Price, MRP.
  - Tax Rate: GST 0%, 5%, 12%, 18%, 28%, or Cess.
  - Reorder point & Minimum stock alert threshold.

---

### 4.9 Purchases & Supplier Ledger (`Purchases.tsx`)
- **Purpose**: Record inward stock purchases from vendors and track accounts payable.
- **Supplier Directory**: Supplier name, GSTIN, Phone, Address, Net balance payable.
- **Inward Bill Entry**:
  - Supplier bill number, Bill date, Due date.
  - Raw material / Product items entry with automatic stock increment.
  - Payment status: Paid, Partial, Credit.

---

### 4.10 Customers & Khata Ledger (`Customers.tsx`, `Statement.tsx`)
- **Customer Directory**:
  - Contact details, GSTIN, Credit Limit, Current Balance (Green for Advance, Red for Due).
- **Customer Profile & Statement (`Statement.tsx`)**:
  - Ledger statement showing all Debit (Invoices) and Credit (Payments) with running balance.
  - **Export Options**: Excel Spreadsheet mode, PDF statement, Thermal receipt statement.
  - **WhatsApp Payment Reminder Button**: Sends one-click payment reminder message with UPI link to customer's mobile.

---

### 4.11 DailyBook / Cash Book (`DailyBook.tsx`)
- **Purpose**: Maintain daily shop cash register.
- **KPI Summary**: Opening Cash, Total Cash In, Total Cash Out, Expected Closing Cash, Physical Cash Verification.
- **Transaction Entry**: Quick "+ Cash In" (Green) and "- Cash Out" (Red) modal with Category (Sales, Expense, Owner Withdrawal, Customer Payment).
- **Day Closing Lock**: Button to reconcile and lock the day's books.

---

### 4.12 Expense Management (`Expenses.tsx`)
- **Categories**: Rent, Electricity, Salaries, Tea & Refreshments, Logistics, Marketing, Maintenance.
- **Fields**: Date, Category, Amount, Payment Mode (Cash, Bank, UPI), Vendor/Beneficiary, Receipt Image upload.
- **Expense Analytics**: Donut chart breakdown of monthly expense distribution.

---

### 4.13 Payments Ledger (`Payments.tsx`)
- **Inward Payments (Received from Customers)**: Invoice link, Payment Date, Amount, Payment Method (Cash, UPI, NEFT/RTGS, Cheque with cheque number).
- **Outward Payments (Paid to Vendors)**: Purchase bill link, Amount, Transaction reference.
- **Filter by Payment Mode**: Instant breakdown of cash collected vs digital UPI payments.

---

### 4.14 Reports & Business Intelligence (`Reports.tsx`)
- **Sales Reports**: Daily, monthly, yearly sales trends; Top-selling products; Most profitable items.
- **Tax Reports (GST Ready)**:
  - **GSTR-1 Report**: B2B Invoices, B2CL (Large), B2CS (Small), Nil-rated, HSN Summary.
  - **GSTR-3B Summary**: Total Taxable Value, Integrated Tax, Central Tax, State Tax, Cess.
- **Profit & Loss**: Gross Profit (Sales - COGS), Net Profit (Gross Profit - Expenses).
- **Customer Aging Report**: Receivables categorized into 0–30 days, 31–60 days, 61–90 days, 90+ days.

---

### 4.15 Barcode & Label Studio (`BarcodeGenerator.tsx`, `BarcodeLabelModal.tsx`)
- **Generator**: Generate Code-128, EAN-13, QR codes for single items or batch bulk import.
- **Customizable Label Templates**:
  - Label Dimensions: 50mm × 25mm, 38mm × 25mm, 2-up, 3-up on A4 sticker sheets.
  - Printable Elements: Store Name, Product Name, Barcode graphic, SKU, MRP, Selling Price.
- **Print Preview**: Direct high-density canvas rendering for thermal label printers (TVS, Zebra, TSC).

---

### 4.16 Universal Accounting Export (`UniversalAccountingExportDashboard.tsx`)
- **Export Targets**:
  - **TallyPrime / Tally ERP 9**: Direct XML export format compatible with Tally import specifications.
  - **Busy Accounting Software**: CSV / Excel import format.
  - **Standard Excel**: Complete multi-sheet workbook (Sales, Purchases, Items, Parties, Taxes).

---

### 4.17 Settings & Configuration (`Settings.tsx`)
10 Organized Configuration Sections:
1. **Company Profile**: Business Name, Tagline, Address, Logo upload, Digital Signature upload.
2. **GST & Taxes**: GSTIN, State code, Composite scheme toggle, Default tax slab.
3. **Print & Invoice Layout**: Default template (Thermal vs A4), Custom invoice footer, Terms & Conditions, Show/Hide HSN column.
4. **Bank & UPI QR**: Bank details, UPI VPA ID (generates dynamic QR code on invoices for instant payment).
5. **Invoice Numbering Prefix**: Custom prefixes (e.g. `INV/26-27/0001`), starting number, auto-reset yearly.
6. **Barcode Scanner Settings**: Beep on scan, Auto-add to cart on scan, Keyboard wedge prefix/suffix.
7. **Storage & Cloud Sync**: Local IndexedDB vs Cloud Firestore selector, Manual JSON Backup, Auto-Restore.
8. **Recycle Bin**: Recover soft-deleted invoices, customers, and items.
9. **Staff & Permissions**: Multi-user roles (Admin, Cashier, Billing Operator).
10. **Theme & Display**: Light Mode / Dark Mode / High Contrast toggle, Font scale slider.

---

### 4.18 Admin & Licensing (`Admin.tsx`, `Pricing.tsx`)
- **Multi-Tenant User Management**: Active users, business details, registration dates.
- **Subscription Approvals**: Review manual UPI payment screenshots and activate Pro licenses.
- **Plan Tiers**:
  - **Free Plan**: Unlimited offline billing, basic thermal prints.
  - **Pro Plan**: Cloud sync across multiple devices, WhatsApp direct invoice links, Tally export, Unlimited items & invoices.

---

## 5. Modal, Drawer & Bottom Sheet Catalog

All modals must adhere to the standardized responsive sheet pattern:
- **Desktop**: Centered modal with backdrop blur (`fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs`).
- **Mobile**: Native Bottom Sheet slide-up (`items-end p-0`), top rounded corners (`rounded-t-3xl`), drag-handle pill indicator at the top, max height `max-h-[92vh] overflow-y-auto`.

| Modal Name | Trigger | Content & Actions |
|---|---|---|
| `WhatsAppShareModal` | WhatsApp icon on Invoice | Pre-composed message text, Customer phone number field, "Send WhatsApp (Direct)" or "Open Web WhatsApp" |
| `SerialNumberInput` | Serial button on Line item | Chip tag input for IMEI/Serial numbers, Barcode scanner trigger, Bulk serial CSV paste |
| `BarcodeLabelModal` | Print Label on Item card | Number of label copies, Paper size selector, Print button |
| `UpgradeModal` | Pro feature clicked | Feature comparison, Pricing cards (Monthly/Annual), QR code for UPI payment, Transaction ID submission |
| `DataBackupRecoveryModal` | Settings > Backup | "Export JSON Backup", "Restore Backup File", "Auto-Backup Schedule" |
| `RecycleBinModal` | Settings > Trash | List of deleted records with timestamp, "Restore" button, "Permanent Delete" |
| `ScannerHelpGuide` | Scanner button helper | Instructions on camera permissions, external USB barcode scanner setup |

---

## 6. Mobile Touch Ergonomics & Form Accessibility Rules

1. **44px/48px Tap Rule**: Every clickable icon, button, and stepper must have at least `44px` physical touch bounds to avoid mis-taps.
2. **Virtual Keyboard Adaptability**: Use `interactive-widget=resizes-content` in viewport meta. Ensure form action buttons (Save/Next) stay visible above the virtual keyboard.
3. **Safe-Area Inset Management**:
   - Headers: `pt-[max(env(safe-area-inset-top),16px)]`
   - Bottom Nav / Action Bars: `pb-[max(env(safe-area-inset-bottom),16px)]`
   - Sides: `pl-safe pr-safe` for notched landscape screens.
4. **Number Inputs**: Use `inputMode="decimal"` or `inputMode="numeric"` for phone numbers, prices, GST rates, and quantities to trigger the numeric keypad on Android/iOS.
5. **Immediate Feedback**: All buttons must have `:hover`, `:active:scale-95`, and `:disabled:opacity-50` states.

---

## 7. Recommended Tech Stack for a Brand-New UI Build

If you are developing a new frontend from scratch using this specification:

- **Option A (Web & Desktop & Capacitor Mobile)**:
  - **Framework**: React 19 / Vite + TypeScript
  - **Styling**: Tailwind CSS v4 + Tailwind Typography
  - **Components**: Radix UI / Headless UI (accessible dialogs, dropdowns, popovers)
  - **Icons**: Lucide React
  - **Animations**: Framer Motion (for bottom sheets, page view transitions, and cart badges)
  - **Charts**: Recharts or Chart.js
  - **Thermal / PDF**: `html2canvas` + `jspdf` or direct canvas ESC/POS generation

- **Option B (Cross-Platform Native: Flutter)**:
  - Material 3 Design Tokens, Riverpod / Bloc State Management, Isar / Hive local database, Zebra / ESC-POS printer plugins.

---

*Document Version: 1.0.38 — InvoCentric UI Specification Blueprint*
