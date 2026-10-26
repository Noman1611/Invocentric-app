# InvoCentric UI v2 Complete Migration Plan

## 1. Executive Summary & Core Rules
This plan governs the visual migration of InvoCentric across Web, Desktop (Electron), and Mobile (Capacitor/Android/iOS/PWA) to the approved Mint/Teal UI design system provided in `InvoCentric-Complete-UI-v2`.

### Strict Invariants:
1. **Preserve 100% of Existing Business Logic & Features**:
   - Zero deletions of routes, fields, dialogs, calculations, filters, reports, shortcuts, or integrations.
   - All real backend/Firestore/Local storage services and database schemas remain intact.
2. **Official Logo & Branding**:
   - Preserve `src/components/Logo.tsx` official geometry and colors (#0F645D / #00473D / #E6F3EE).
3. **Approved Design Tokens Only**:
   - Background: `#F6F8F3` (Pale canvas)
   - Hero Mint: `#D7F4D4`
   - Hero Tab Active: `#C6E9C1`
   - Dark Cards & Accent: `#073E36`
   - Nav Dark: `#10251F`
   - Primary Brand: `#0F645D`
   - Border: `#E5EBE0` / `#E9EEE4`
   - Radii: Inputs 16px, Buttons 18-20px, Cards 26px, Hero 30px, Pills 999px
   - Typography: Manrope, Inter, sans-serif
4. **Invoice Documents & Printing Integrity**:
   - Preserve all 16 production invoice templates.
   - Do NOT leak the application mint/teal theme into printed invoices or exported PDFs.
   - Print: black text & black lines.
   - PDF/Share: black text & blue lines.
   - Retain A4, A5, POS 2-inch, POS 3-inch, and Voucher A5 formats with zero blank pages.

---

## 2. Phased Migration Sequence

### Phase A: Complete Audit & Checkpoint [COMPLETED]
- Git branch `feature/ui-v2-migration` created.
- Project routes and components catalogued.
- Verification baseline established: build passes, 117/117 unit tests pass, type-check passes.
- `FEATURE_PARITY_MATRIX.csv` created.

### Phase B: Design System Tokens & Shared UI Primitives
- Integrate foundational tokens into `src/index.css`:
  - Scoped `.ic-ui` / `.ic-card` / `.ic-btn` / `.ic-field` utilities and CSS variables.
  - Setup Manrope font fallback hierarchy.
- Create/update shared primitive UI components matching the approved design:
  - `MetricCard` (dark/mint/white variants, tabular numerals)
  - `SegmentedTabs` (pill shaped tabs with active white card)
  - `StatusBadge` (mint green, soft red, amber pill badges)
  - `FloatingDarkNav` (mobile dark pill with active mint capsule expansion)
  - `DesktopSidebar` (teal navigation rail with badge counters)
  - `PageHeader` (clean title, search, sync pill, profile pill)

### Phase C: Shared Navigation & Application Shells
- Update `App.tsx` PrivateRoute layout:
  - Top header with mobile brand, search shortcut ⌘K, storage sync pill, notifications bell, and user avatar pill.
  - Floating dark mobile pill nav in `MobileNav.tsx`: Home, Invoices, (+ Quick POS/Scan), Parties, More Menu.
  - Responsive desktop sidebar in `Sidebar.tsx` with active mint pill states.
  - Preserve all modals (StorageModeModal, GlobalShortcutsManager, DemoScriptModal, OnboardingGuide, UpgradeModal, etc.).

### Phase D: Dashboard Migration
- Redesign `src/pages/Dashboard.tsx` to match frames IC-013 through IC-018:
  - Greeting with owner/business name.
  - Dominant mint hero card with period tabs (Today / This Week / This Month / This Year), total sales with tabular numerals, and growth indicator.
  - Mini stats cards: Payments Received (white card) & Customer Dues (dark teal card).
  - Four circular action shortcuts: Create Invoice, POS Billing, Add Party, Add Product.
  - Prominent POS action card with arrow trigger.
  - Sales bar chart card with period selector and visual bars.
  - Recent transactions list with circular initials, payment status badges, and formatted amounts.
  - Stock summary & Recycle Bin quick access cards.

### Phase E: Invoices, Quotations & Document Controls
- Redesign `src/pages/Invoices.tsx` (IC-019, IC-020):
  - Pill status filters (All, Paid, Unpaid, Partial, Overdue).
  - Clean search bar, date range picker.
  - List of invoice records with status badges and quick actions.
- Update `src/pages/CreateInvoice.tsx` & `src/pages/Quotations.tsx` (IC-021 to IC-030, IC-040 to IC-043):
  - Modern form grid, customer selector, item selector with tax slab & HSN display.
  - Responsive line item editor, discount & GST summary panel.
  - Sticky bottom action bar with Grand Total and Save/Print actions.
  - 1-click quotation conversion confirmation modal.
- Verify `src/pages/InvoiceView.tsx`:
  - Keep production renderer and all 16 templates intact with the new preview wrapper.

### Phase F: POS, Scanner, Cart & Payments
- Redesign `src/pages/QuickPOS.tsx` & `src/pages/MobileScan.tsx` (IC-044 to IC-054):
  - Product grid with quick-tap tiles and stock status badges.
  - Sticky/slide-over cart with real-time quantity steppers.
  - Split payment drawer (Cash, UPI, Khata, Card).
  - Preserved USB laser scanner and camera scanner integration.

### Phase G: Products & Inventory
- Redesign `src/pages/Items.tsx` (IC-055 to IC-065):
  - 6 tab views: All Products, Low Stock, Services, Batches & Expiry, Serial/IMEI, Bulk Import/Export.
  - Modern item cards with stock status and quick edit.
  - Add/Edit product sheet matching the new input and field styling.

### Phase H: Customers, Suppliers & Ledgers
- Redesign `src/pages/Customers.tsx`, `src/pages/Purchases.tsx`, and `src/pages/Statement.tsx` (IC-066 to IC-082):
  - Customer directory with balance badges and WhatsApp reminder buttons.
  - Ledger timeline with running balance.
  - Supplier directory and purchase entry forms.

### Phase I: Cash Book, Expenses & Daily Book
- Redesign `src/pages/DailyBook.tsx` & `src/pages/Expenses.tsx` (IC-083 to IC-090):
  - Daily cash overview, opening/closing cash balances.
  - Category filtered expense entries and daily profit/loss card.

### Phase J: Reports & Business Tools
- Redesign `src/pages/Reports.tsx`, `src/pages/BarcodeGenerator.tsx`, `src/pages/QrGenerator.tsx` (IC-091 to IC-108):
  - Clean report cards with date pickers, GST liability cards, and export buttons.
  - Barcode label print sheet and UPI QR payment preview.

### Phase K: Authentication, Settings, Plans & Storage
- Redesign `src/pages/LoginPage.tsx`, `src/pages/Settings.tsx`, `src/pages/Pricing.tsx` (IC-001 to IC-006, IC-109 to IC-130):
  - Authentication screen with official logo, Google sign-in button, and email form.
  - Grouped setting rows with clean toggle switches.
  - Pro pricing comparison cards with direct UPI payment modal.
  - Storage mode toggle (Local PC vs Cloud Sync).

### Phase L: Admin & Remaining Views
- Redesign `src/pages/Admin.tsx` (IC-131 to IC-136):
  - Admin dashboard, user table, instant 1-click subscription request approvals/rejections.

### Phase M: Cross-Platform Verification & Parity Sign-Off
- Run build, tsc, and full test suite across 8 viewports (320px to 1440px).
- Verify mobile, desktop, and web responsiveness.
