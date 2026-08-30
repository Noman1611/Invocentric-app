# Project: InvoCentic Comprehensive Responsive UI Overhaul

## Architecture & Design Principles

InvoCentic is a high-performance Billing, POS, and Business Management web application built with React 19, TypeScript, and Tailwind CSS v4. The Responsive UI Overhaul delivers a polished, native-like mobile app experience on smartphones (320px–414px), tablet displays (768px–1024px), and desktop web app layouts (>=1024px) without altering any existing business logic, Firestore queries, offline caching, GST computations, or print/PDF engines.

### Key Architectural Guidelines
1. **Zero Viewport Overflow (R1)**:
   - On all viewports from 320px to 1440px+: `document.body.scrollWidth === window.innerWidth`.
   - Elimination of all fixed pixel min-widths (`min-w-[360px]`, `min-w-[500px]`, `min-w-[700px]`) causing horizontal page blowout.
   - `interactive-widget=resizes-content` on `index.html` to adapt seamlessly to mobile virtual keyboards.
2. **Native Mobile Touch Ergonomics & Card Reflow (R2)**:
   - Dense multi-column tables automatically reflow to thumb-friendly touch cards on `< 768px` (`hidden md:block` table + `block md:hidden` cards).
   - Touch targets >= 44px for primary buttons, quantity steppers, action icons, and form triggers.
   - Active touch feedback (`active:scale-95`, smooth transitions).
3. **Safe-Area Navigation Clearance (R3)**:
   - Dynamic safe-area padding using `env(safe-area-inset-*)` (`.pb-safe`, `.pt-safe`, `.pl-safe`, `.pr-safe`, `.mb-safe`).
   - Main scroll container preserves `pb-28` to guarantee clean separation above the mobile bottom navigation bar (`MobileNav`).
   - Sticky bottom action bars in forms and POS include safe clearance.
4. **Modal & Bottom Sheet Standardization**:
   - Universal responsive sheet pattern: `fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto`.
   - Native bottom-sheet styling on mobile: `rounded-t-3xl sm:rounded-2xl`, drag handle bar, sticky header/footer, and `max-h-[94vh] sm:max-h-[90vh] overflow-y-auto`.
5. **Zero Logic Regressions (R4)**:
   - All state management (Context, Zustand, Firestore hooks, offline queue), GST/discount formulas, stock deduction logic, and print/PDF rendering engines remain 100% untouched.

---

## Feature Inventory

| # | Feature / Area | Description | Milestone | Source |
|---|----------------|-------------|-----------|--------|
| 1 | Viewport & Meta Tags | Add `interactive-widget=resizes-content` to `index.html` meta viewport | M1 | Survey 1 (DONE) |
| 2 | Safe-Area CSS Utilities | Define `.pb-safe`, `.pt-safe`, `.pl-safe`, `.pr-safe`, `.mb-safe` in `src/index.css` | M1 | Survey 1 (DONE) |
| 3 | Border Radius Rule Fix | Exempt directional classes (`rounded-t-*`, `rounded-b-*`) in `src/index.css` wildcard selector | M1 | Survey 1 (DONE) |
| 4 | Mobile Navigation Sizing | Replace fixed `w-16` with fluid `flex-1 max-w-[68px]` and safe-area height in `MobileNav.tsx` | M1 | Survey 1 (DONE) |
| 5 | Top Header Cleanliness | Collapse non-essential header action buttons into menu on `< sm` in `App.tsx` | M1 | Survey 1 (DONE) |
| 6 | Scroll Container Clearance | Verify `pb-28` and eliminate nested `h-screen` in `App.tsx` | M1 | Survey 1 (DONE) |
| 7 | DataBackupRecovery Typo Fix | Fix pre-existing identifier typo `handleRestoreAutoBackup` -> `handleAutoRestore` | M1 | Survey 3 (DONE) |
| 8 | QuickPOS Mobile Cart Drawer | Add Customer inputs & Payment Mode selectors inside mobile cart sheet in `QuickPOS.tsx` | M2 | Survey 2 (DONE) |
| 9 | QuickPOS Touch Steppers | Increase quantity minus/plus stepper buttons to >=36px with >=44px tap boundaries in `QuickPOS.tsx` | M2 | Survey 2 (DONE) |
| 10 | QuickPOS Responsive Grids | Eliminate nested `h-screen` and optimize product card grid on <=360px in `QuickPOS.tsx` | M2 | Survey 2 (DONE) |
| 11 | CreateInvoice Dropdown Fix | Remove `min-w-[360px]` on customer search dropdown in `CreateInvoice.tsx` | M2 | Survey 2 (DONE) |
| 12 | CreateInvoice Line Item Cards | Convert dense multi-column line items table into responsive item cards with collapsible drawer on `< 768px` | M2 | Survey 2 (DONE) |
| 13 | CreateInvoice Action Bar | Provide thumb-friendly sticky checkout action bar with `pb-28` clearance in `CreateInvoice.tsx` | M2 | Survey 2 (DONE) |
| 14 | InvoiceView Responsive View | Refine mobile view and action bar in `InvoiceView.tsx` while preserving `@media print` rules | M2 | Survey 2 (DONE) |
| 15 | SerialNumberInput Touch Polish | Ensure serial number input and badge list are responsive and touch-friendly | M2 | Survey 2 (DONE) |
| 16 | Invoices List Reflow | Reflow Invoices table into responsive card stack on `< 768px` in `Invoices.tsx` | M3 | Survey 3 |
| 17 | Quotations List Reflow | Reflow Quotations table into responsive card stack on `< 768px` in `Quotations.tsx` | M3 | Survey 3 |
| 18 | DailyBook Responsive View | Add mobile card summary view and touch-scroll ledger container in `DailyBook.tsx` | M3 | Survey 3 |
| 19 | Expenses List Reflow | Reflow Expenses table into responsive card stack on `< 768px` in `Expenses.tsx` | M3 | Survey 3 |
| 20 | Dashboard Activity Reflow | Reflow recent transactions table into responsive cards on `< 768px` in `Dashboard.tsx` | M3 | Survey 1/3 |
| 21 | Items & Inventory Reflow | Reflow 6 inventory sub-tabs (Products, Stock, Serials, Low Stock, etc.) into responsive cards on `< 768px` in `Items.tsx` | M4 | Survey 3 |
| 22 | Customers Grid Polish | Refine customer card grid, action chips, and mobile search bar on 320px–375px in `Customers.tsx` | M4 | Survey 3 |
| 23 | Purchases Table Reflow | Reflow Purchases table and statement into responsive cards on `< 768px` in `Purchases.tsx` | M4 | Survey 3 |
| 24 | Payments Ledger Reflow | Reflow Payments ledger table into responsive cards on `< 768px` in `Payments.tsx` | M4 | Survey 3 |
| 25 | Reports & Analytics Reflow | Reflow Invoices and Payments report tables into responsive cards on `< 768px` in `Reports.tsx` | M4 | Survey 3 |
| 26 | Statement Responsive View | Ensure Excel spreadsheet mode is wrapped in touch-scroll container with thermal receipt mode on mobile in `Statement.tsx` | M4 | Survey 3 |
| 27 | Admin Tables Reflow | Verify dual table + card reflow across all 4 admin tabs in `Admin.tsx` | M4 | Survey 3 |
| 28 | Universal Modal Bottom Sheets | Standardize all modals (`Purchases.tsx`, `Expenses.tsx`, `Payments.tsx`, `UpgradeModal.tsx`, `WhatsAppShareModal.tsx`, `BulkSerialModal.tsx`) with bottom sheet layout & `max-h-[94vh] overflow-y-auto` | M5 | Survey 3 |
| 29 | Settings Responsive Sections | Responsive grid reflow (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`) for all 10 settings sections in `Settings.tsx` | M5 | Survey 3 |
| 30 | Remaining Dialogs Polish | Verify and polish any remaining dialogs/drawers across the app | M5 | Survey 3 |
| 31 | Full E2E Test Suite Pass | Run and pass 100% of Tiers 1-4 E2E tests across all 8 viewports | M6 | Orchestrator |
| 32 | Adversarial Hardening | Tier 5 adversarial stress testing and coverage hardening | M6 | Orchestrator |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Viewport Shell, Safe-Area CSS & Navigation Shell | `index.html`, `src/index.css`, `src/App.tsx`, `src/components/MobileNav.tsx`, `src/components/Sidebar.tsx`, `src/components/DataBackupRecoveryModal.tsx` | None | DONE |
| M2 | POS & Billing Checkout Mobile Reflow & Ergonomics | `src/pages/QuickPOS.tsx`, `src/pages/CreateInvoice.tsx`, `src/pages/InvoiceView.tsx`, `src/components/SerialNumberInput.tsx` | M1 | DONE |
| M3 | Core Transactional Tables-to-Cards Reflow | `src/pages/Invoices.tsx`, `src/pages/Quotations.tsx`, `src/pages/DailyBook.tsx`, `src/pages/Expenses.tsx`, `src/pages/Dashboard.tsx` | M1, M2 | PLANNED |
| M4 | Inventory, Parties, Reports & Admin Responsive Reflow | `src/pages/Items.tsx`, `src/pages/Customers.tsx`, `src/pages/Purchases.tsx`, `src/pages/Payments.tsx`, `src/pages/Reports.tsx`, `src/pages/Statement.tsx`, `src/pages/Admin.tsx` | M1, M2 | PLANNED |
| M5 | Modals, Bottom Sheets, Drawers & Settings Standardization | `src/components/UpgradeModal.tsx`, `src/components/WhatsAppShareModal.tsx`, `src/components/BulkSerialModal.tsx`, `src/components/UpdateCatalogEntryModal.tsx`, `src/pages/Settings.tsx`, and all remaining dialogs | M1, M2 | PLANNED |
| M6 | Final Verification: 100% E2E Test Pass & Tier 5 Hardening | Full test suite execution across 320px, 360px, 375px, 390px, 414px, 768px, 1024px, 1440px + adversarial audit | M1, M2, M3, M4, M5 | PLANNED |

---

## Code Layout

- `index.html`: Base HTML, viewport configuration, safe-area meta tags.
- `src/index.css`: Global styles, safe-area utility classes (`.pb-safe`, `.pt-safe`, etc.), border-radius overrides, print engine rules.
- `src/App.tsx`: App shell, top header, main scroll container with `pb-28`, route management.
- `src/components/MobileNav.tsx`: Mobile bottom navigation bar, dynamic safe area height, quick action triggers.
- `src/components/Sidebar.tsx`: Desktop collapsible navigation sidebar.
- `src/pages/QuickPOS.tsx`: POS / Quick billing screen, product grid, mobile cart bottom sheet with customer & payment controls.
- `src/pages/CreateInvoice.tsx`: Invoice creation & editing, responsive line item cards, sticky checkout action bar.
- `src/pages/Invoices.tsx`, `Quotations.tsx`, `DailyBook.tsx`, `Expenses.tsx`, `Dashboard.tsx`: Transactional data views with dual table/card reflow.
- `src/pages/Items.tsx`, `Customers.tsx`, `Purchases.tsx`, `Payments.tsx`, `Reports.tsx`, `Statement.tsx`, `Admin.tsx`: Entity management and reporting views.
- `src/components/*Modal.tsx`, `src/pages/Settings.tsx`: Modals, dialogs, drawers, and configuration tabs.
- `tests/`: Opaque-box E2E test suite covering viewport overflow, touch targets, safe-area clearance, table reflows, and zero logic regressions across 8 viewport dimensions.
