# InvoCentic Responsive UI Overhaul — Explorer 3 Survey Report
**Area**: Data Tables, Responsive Cards, Modals, Dialogs, Drawers, Settings & Entity Management  
**Explorer**: Explorer 3  
**Date**: August 30, 2026  
**Status**: Comprehensive Investigation Complete (Read-Only)

---

## 1. Executive Summary & Scope Overview

Explorer 3 conducted an in-depth, code-level survey across all data-dense entity pages, tabular views, modal dialogs, drawers, floating popovers, and settings configurations in InvoCentic.

### Key Discoveries:
1. **Dense Tabular Interfaces (14+ views)**: Currently rely on standard `<table>` elements wrapped in basic `overflow-x-auto`. While this prevents layout breakout on desktop, on small mobile viewports (320px–414px) wide tables require severe horizontal panning, obscuring critical billing numbers, status badges, and action buttons.
2. **Exemplary Responsive Blueprints Already Exist**:
   - `src/pages/Admin.tsx` (Lines 1621–1746) implements a dual-view approach: `hidden md:block` table for desktop and `block md:hidden space-y-4` card layout for mobile, featuring >=44px touch targets and quick-action toolbars.
   - `src/components/UpdateCatalogEntryModal.tsx` (Lines 258–305) implements native-like mobile bottom-sheet ergonomics: `items-end sm:items-center`, `rounded-t-3xl sm:rounded-3xl`, mobile drag handle `<div className="sm:hidden w-12 h-1.5 ...">`, `max-h-[94vh] sm:max-h-[90vh] overflow-y-auto`, and sticky headers/footers.
3. **Modal Viewport Clipping Risks (18+ modals)**: Multiple modals across `Purchases.tsx`, `Expenses.tsx`, `Payments.tsx`, `UpgradeModal.tsx`, `WhatsAppShareModal.tsx`, and `BulkSerialModal.tsx` use fixed centering (`top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`) or lack `max-h-[90vh] overflow-y-auto`, causing clipping on 320px–375px screens when virtual keyboards or long content appear.
4. **Settings Grid Squashing**: `Settings.tsx` contains multi-column form layouts (`grid-cols-2` and `grid-cols-3`) that lack responsive breakpoint prefixes (`sm:` or `md:`), squishing input fields on narrow smartphones.
5. **Build & Type Verification**:
   - `npm run build` succeeds cleanly in 50.75s with zero bundler errors.
   - `npx tsc --noEmit` revealed a pre-existing TypeScript name mismatch in `src/components/DataBackupRecoveryModal.tsx` (line 318 calls `handleRestoreAutoBackup` while function is defined as `handleAutoRestore` at line 128).

---

## 2. Exhaustive Inventory of Tabular & Entity Pages

Below is the complete analysis of all tabular and entity management pages across InvoCentic:

| Page / Route | File Path | Current Structure | Key Columns / Fields | Current Mobile Behavior | Required Mobile Reflow Pattern (<768px) |
|---|---|---|---|---|---|
| **Invoices Ledger** (`/invoices`) | `src/pages/Invoices.tsx` (Lines 308–423) | `<table className="w-full text-left">` inside `overflow-x-auto` | Transaction ID, Client Name, Status, Amount, Due Date, Actions (View, Pay, Delete) | Horizontal scroll on `<768px`; columns compressed on 320px–375px | **Card Reflow**: Top row: `#INV-XXXX` + Status badge; Mid row: Client name + Item summary + Amount (large bold); Bottom row: Due date + 3-button touch action bar (View, Mark Paid, Delete) |
| **Quotations / Estimates** (`/quotations`) | `src/pages/Quotations.tsx` (Lines 128–221) | `<table className="w-full text-left border-collapse">` inside `overflow-x-auto` | Quote ID & Type, Customer (Name + Phone), Date, Amount, Actions (Convert to Invoice, View, Delete) | 5 columns scroll horizontally; action buttons squished | **Card Reflow**: Top row: Quote ID + Type pill; Mid: Customer Avatar + Name + Phone + Amount; Bottom: Full-width "Convert to Invoice" button + View/Delete icon buttons (>=44px touch) |
| **Products List** (`/items?tab=products`) | `src/pages/Items.tsx` (Lines 1235–1355) | Toggleable Grid vs `<table className="w-full text-left">` | Product Info (Icon, Name, Barcode, Size, HSN), Category, Pricing, Inventory Stock (+/- quick buttons), Actions | Table mode overflows horizontally; Grid mode cards are responsive but need tighter mobile spacing | **Responsive Card List**: Product image/icon + Title + Category chip; Inline Stock stepper (- [Qty] +); Price + Action dropdown/buttons |
| **Stock Overview** (`/items?tab=overview`) | `src/pages/Items.tsx` (Lines 591–655) | 4 stat metric cards + 6-column `<table>` | Product Name, Category, SKU/Barcode, Stock, Status, Action | Stat cards wrap nicely, but table scrolls horizontally on small screens | **Summary Cards**: Stat cards 2x2 grid on mobile; table replaced by compact product stock status cards with reorder badges |
| **Serial Numbers** (`/items?tab=serials`) | `src/pages/Items.tsx` (Lines 760–808) | `<table className="w-full text-left text-xs">` | Product Name, Total Serials, Serial Numbers Preview, Actions | Horizontal scrolling table | **Compact Serial Cards**: Item name + count badge + scrollable horizontal chips for IMEIs/serials + Add/Import button |
| **Lot / Batch Stock** (`/items?tab=batches`) | `src/pages/Items.tsx` (Lines 816–854) | `<table className="w-full text-left text-xs">` | Product Name, Batch Number, Manufacturing Date, Expiry Date, Batch Qty | Horizontal scroll | **Batch Card Stack**: Batch No badge + Expiry alert countdown + Current stock |
| **Low Stock Alerts** (`/items?tab=lowstock`) | `src/pages/Items.tsx` (Lines 861–912) | `<table className="w-full text-left text-xs">` | Product Name, Current Stock, Threshold, Deficit, Action (Quick Restock) | Horizontal scroll | **Urgent Action Cards**: Prominent red danger chip, remaining units count, 1-tap "Quick Restock" button |
| **Inventory History** (`/items?tab=history`) | `src/pages/Items.tsx` (Lines 966–990) | `<table className="w-full text-left text-xs">` | Date, Event Type, Product, Change (+/-), Performed By | Horizontal scroll | **Timeline Cards**: Date badge + Event icon (Green In / Red Out) + Product name + Delta quantity |
| **Customer / Client Directory** (`/customers`) | `src/pages/Customers.tsx` (Lines 314–405) | Responsive Card Grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) | Avatar Initial, WhatsApp Reminder, Edit, Delete, Name, Company, Email, Phone, Address, Custom Fields (PAN, DL, etc.), Statement Button | Excellent responsive card foundation; on 320px needs `p-4` instead of `p-6` to avoid boundary squishing | **Refined Touch Cards**: Retain card layout, ensure custom field chips wrap cleanly without horizontal overflow; 1-click WhatsApp and Full Statement buttons >= 44px |
| **Purchases Ledger** (`/purchases`) | `src/pages/Purchases.tsx` (Lines 414–520) | `<table className="w-full min-w-[520px] text-left border-collapse">` inside `overflow-x-auto` | Date, Supplier/Items, Payment Method & Status, Amount, Actions (Mark Paid, Delete) | `min-w-[520px]` causes horizontal scrolling on all mobile screens | **Card Reflow**: Top: Date + Status chip; Mid: Vendor name + Description + Payment Method; Bottom: Amount (bold) + Mark Paid / Delete touch buttons |
| **Supplier Statement** (`/purchases` modal) | `src/pages/Purchases.tsx` (Lines 833–910) | `<table className="w-full border-collapse border border-neutral-300 text-xs">` | Sr., Date, Description, Pay Method, Status, Amount | Embedded in modal with 6 fixed columns (`w-12`, `w-28`, `w-32`) | **Touch-scroll table with sticky summary**: Horizontal scroll wrapper with sticky header and card summary header |
| **Payments Received** (`/payments`) | `src/pages/Payments.tsx` (Lines 169–216) | `<table className="w-full text-left">` inside `glass-card overflow-hidden` (missing `overflow-x-auto`!) | Date, Customer, Note, Amount, Delete | Table overflows bounding container on `<768px` | **Payment Entry Cards**: Date + Customer Avatar & Name; Note / Reference pill; Bold green amount (`+₹...`); Delete icon button |
| **Daily Cash Book** (`/dailybook`) | `src/pages/DailyBook.tsx` (Lines 780–844) | 7-column spreadsheet `<table className="w-full text-left text-xs border-collapse">` | #, Type, Party, Details, Method, Cash In (+), Cash Out (-) | 7 columns with border lines; requires horizontal swipe on mobile | **Dual Approach**: (1) Compact transaction feed card stack grouped by transaction type on mobile; (2) Retain Excel table inside touch-scroll container with visual swipe hint |
| **Expenses Tracker** (`/expenses`) | `src/pages/Expenses.tsx` (Lines 180–250) | 6-column `<table className="w-full text-left border-collapse">` inside `overflow-x-auto` | Date, Description, Category, Method, Amount, Actions | Scrolls horizontally on mobile | **Expense Cards**: Category pill + Date; Description + Payment method; Amount (bold) + Delete button |
| **Reports - Sales Ledger** (`/reports`) | `src/pages/Reports.tsx` (Lines 922–995) | `<table className="w-full text-left border-collapse min-w-[700px]">` | Invoice Number, Customer Name, Issue Date, Status, Billing Amount, Actions | `min-w-[700px]` forces horizontal panning | **Report Invoices Cards**: Invoice # + Status badge; Customer + Date; Amount + View link button |
| **Reports - Collections Ledger** (`/reports`) | `src/pages/Reports.tsx` (Lines 1019–1075) | `<table className="w-full text-left border-collapse min-w-[700px]">` | Customer Name, Payment Date, Method, Reference ID, Amount Received | `min-w-[700px]` forces horizontal panning | **Collections Cards**: Customer name + Date; Method badge + Reference ID; Received amount |
| **Customer Statement** (`/customers/statement/:id`) | `src/pages/Statement.tsx` (Lines 930–1080) | 6-column Ledger table (Date, Description, Type, Debit, Credit, Running Balance) | Date, Description (expandable items), Type, Debit (+), Credit (-), Balance | Excel mode table scrolls horizontally; Thermal receipt mode (Lines 870–926) is already mobile-optimized | **Adaptive Ledger Cards / Touch Table**: Excel mode wraps in horizontal scroll with sticky Date & Description; Thermal mode provides native receipt card view |
| **Admin User Directory & Requests** (`/admin`) | `src/pages/Admin.tsx` (Lines 1621–1746, 2463–2530) | Dual Table + Mobile Cards already implemented for subscription requests; 4 tables in total | User Email, Ref/UTR, Plan Cycle, Amount, Date, Actions | Desktop shows `min-w-[700px]` table; Mobile shows `block md:hidden` cards | **Golden Reference Implementation**: Apply existing Admin card pattern across all other tabular pages |
| **Barcode Generator Batch Table** (`/barcode-generator?tab=bulk`) | `src/pages/BarcodeGenerator.tsx` (Lines 780–840) | 10-column interactive input table (`checkbox`, Product Name, SKU, Format, Value, Price, MRP, Qty, Preview, Action) | Checkbox, Name, SKU, Barcode, Price, MRP, Qty, Preview, Delete | Wide interactive inputs scroll horizontally | **Responsive Row Cards on <768px**: Card with item inputs, quantity stepper, barcode live canvas preview, and remove button |
| **Dashboard Recent Invoices** (`/dashboard`) | `src/pages/Dashboard.tsx` (Lines 475–534) | `<table className="w-full text-left border-collapse min-w-[600px] whitespace-nowrap">` | Invoice #, Customer, Date, Amount, Status, Action | `min-w-[600px]` forces horizontal scroll | **Recent Invoices Mobile List**: 1-column list with Invoice # + Status pill + Customer + Date + Bold amount |
| **Subscription Receipts History** (`/settings`) | `src/pages/Settings.tsx` (Lines 1201–1240) | 5-column `<table className="w-full text-left border-collapse">` | Receipt No, Date, Billing Cycle, Amount, Action (Download) | Table scrolls horizontally on small screens | **Receipt History Cards**: Receipt # + Date + Billing Cycle pill + Amount + 1-click Download button |

---

## 3. Table Mobile Reflow Architectural Patterns (<768px)

### Recommended Dual-View Pattern:
For all primary tabular views (`Invoices.tsx`, `Quotations.tsx`, `Purchases.tsx`, `Payments.tsx`, `Expenses.tsx`, `Reports.tsx`), adopt the pattern proven in `Admin.tsx`:

```tsx
{/* Desktop Table View (>= 768px) */}
<div className="hidden md:block overflow-x-auto">
  <table className="w-full text-left border-collapse">
    {/* Full tabular layout */}
  </table>
</div>

{/* Mobile Touch Cards View (< 768px) */}
<div className="block md:hidden space-y-3">
  {items.map((item) => (
    <div key={item.id} className="card-base p-4 bg-white border border-slate-100/80 rounded-2xl space-y-3 shadow-xs active:scale-[0.99] transition-transform">
      {/* Top Bar: Identity + Status */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-900 text-sm">{item.title}</span>
        <span className={cn("badge text-[10px] uppercase font-black", statusClass)}>{item.status}</span>
      </div>
      
      {/* Mid: Primary & Secondary Metadata */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{item.secondaryText}</span>
        <span className="font-extrabold text-slate-900 text-sm tabular-nums">{item.amountFormatted}</span>
      </div>

      {/* Bottom Bar: Touch Action Buttons (>= 44px height) */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
        {/* Quick Actions */}
      </div>
    </div>
  ))}
</div>
```

### Key Touch Ergonomics Criteria:
1. **Tap Target Size**: All action buttons must meet `>= 44px` height/width (`min-h-[44px]` or `p-2.5 sm:p-2`).
2. **Active Touch Feedback**: Include `active:scale-95` or `active:bg-slate-100` for tactile mobile response.
3. **No Horizontal Body Overflow**: Outer containers must never exceed `100vw`. Ensure `w-full max-w-full overflow-hidden`.
4. **Scroll Container Clearance**: All scrollable main containers must retain `pb-24` or `pb-28` to clear `MobileNav` (fixed bottom navigation bar, height 68px + safe area inset).

---

## 4. Exhaustive Audit of Modals, Dialogs, Drawers & Floating Popovers

We audited all 18+ modals, drawers, and popovers across InvoCentic. Below is the comprehensive classification and vulnerability catalog:

```
====================================================================================================
MODAL COMPONENT AUDIT & VIEWPORT CLIPPING MATRIX
====================================================================================================
```

| Modal / Dialog Name | File Path & Lines | Current Container Styling | Sizing & Viewport Issues on 320px–414px | Recommended Remediation |
|---|---|---|---|---|
| **Add/Edit Customer Modal** | `src/pages/Customers.tsx` (Lines 411–613) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-xl max-h-[90vh] flex flex-col` | Custom fields list and voice button can overflow if expanded; `p-8` on 320px screen is too wide. | Change to `items-end sm:items-center p-0 sm:p-4`, `rounded-t-3xl sm:rounded-2xl`, `p-4 sm:p-8`, add mobile drag handle. |
| **Delete Customer Alert** | `src/pages/Customers.tsx` (Lines 618–658) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-sm p-8 text-center` | `p-8` leaves small space on 320px; centered positioning fine for small alert dialogs. | Adjust padding to `p-6 sm:p-8`, button heights `min-h-[44px]`. |
| **Delete Invoice Alert** | `src/pages/Invoices.tsx` (Lines 426–465) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-sm p-8 text-center` | `p-8` on 320px width causes excessive padding. | Adjust padding to `p-6 sm:p-8`, button heights `min-h-[44px]`. |
| **Update Catalog Entry Modal** | `src/components/UpdateCatalogEntryModal.tsx` (Lines 258–305) | `fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto` -> `max-w-3xl lg:max-w-4xl rounded-t-3xl sm:rounded-3xl max-h-[94vh] sm:max-h-[90vh]` | **GOLDEN STANDARD**: Already has mobile handle indicator, bottom-sheet styling, sticky headers, and responsive grid. | Retain as reference template for other modals. |
| **Barcode Scanner Modal** | `src/pages/Items.tsx` (Lines 1453–1570) | `fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4` -> `max-w-md rounded-[28px] p-5 md:p-6` | Camera viewfinder requires fixed aspect ratio; tabs can squeeze on 320px. | Keep `p-3 sm:p-4`, ensure scanner tabs stack or shrink on `<360px`. |
| **AI Bill Scan OCR Modal** | `src/pages/Items.tsx` (Lines 1700–1850) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-2xl max-h-[90vh] overflow-y-auto` | Extracted items table can overflow horizontally inside the modal. | Wrap extracted item list in responsive card reflow inside the modal. |
| **Record Purchase Modal** | `src/pages/Purchases.tsx` (Lines 527–670) | `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[70] p-4` -> `p-8 rounded-[2.5rem]` | **HIGH RISK**: Fixed absolute centering; missing `max-h-[90vh] overflow-y-auto`. When virtual keyboard opens on phone, bottom buttons are unreachable! | Remove absolute centering, use `fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4`, add `max-h-[90vh] overflow-y-auto`. |
| **Supplier Statement Modal** | `src/pages/Purchases.tsx` (Lines 720–930) | `fixed inset-0 bg-neutral-950/40 z-[60]` -> `max-w-4xl max-h-[90vh] flex flex-col` | Summary stat tiles (`grid-cols-3 gap-4`) squeeze on 320px; table inside modal has fixed widths. | Reflow summary stats to `grid-cols-1 sm:grid-cols-3 gap-2`, wrap table with touch scroll. |
| **Record Payment Modal** | `src/pages/Payments.tsx` (Lines 220–350) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-lg rounded-3xl p-8` | **HIGH RISK**: Missing `max-h-[90vh] overflow-y-auto`; `p-8` is too wide on 320px; `grid-cols-2` squeezes inputs. | Change to `items-end sm:items-center p-0 sm:p-4`, `rounded-t-3xl sm:rounded-3xl`, `p-5 sm:p-8`, `grid-cols-1 sm:grid-cols-2`, add `max-h-[90vh] overflow-y-auto`. |
| **Add Expense Modal** | `src/pages/Expenses.tsx` (Lines 254–373) | `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[70] p-4` -> `p-8 rounded-[2.5rem]` | **HIGH RISK**: Fixed centering, missing `max-h-[90vh] overflow-y-auto`, button clipping on short viewports. | Change to `fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4`, `rounded-t-3xl sm:rounded-3xl`, `p-5 sm:p-8`, `max-h-[90vh] overflow-y-auto`. |
| **Delete Quotation Alert** | `src/pages/Quotations.tsx` (Lines 224–264) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-md rounded-3xl p-8 text-center` | `p-8` causes narrow content on 320px. | Change to `p-6 sm:p-8`, `min-h-[44px]` button touch targets. |
| **Upgrade to Pro Modal** | `src/components/UpgradeModal.tsx` (Lines 19–110) | `fixed inset-0 z-[100] flex items-center justify-center p-4` -> `max-w-md rounded-[2rem] p-8` | **HIGH RISK**: Missing `max-h-[90vh] overflow-y-auto`. On screens with height < 640px (iPhone SE), the benefits list and CTA buttons clip off! | Add `max-h-[92vh] overflow-y-auto`, change to `items-end sm:items-center p-0 sm:p-4`, `rounded-t-3xl sm:rounded-[2rem]`, `p-5 sm:p-8`. |
| **WhatsApp Share Modal** | `src/components/WhatsAppShareModal.tsx` (Lines 34–146) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-md rounded-3xl p-6 md:p-8` | Missing `max-h-[90vh] overflow-y-auto`. Step instructions and multi-button action stack clip on small mobile height. | Add `max-h-[90vh] overflow-y-auto`, `items-end sm:items-center p-0 sm:p-4`, `rounded-t-3xl sm:rounded-3xl`. |
| **Barcode Label Printing Modal** | `src/components/BarcodeLabelModal.tsx` (Lines 60–105) | `fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4` -> `max-w-5xl max-h-[92vh]` | Left controls vs right preview (`grid-cols-1 lg:grid-cols-3`) stacks well, but control inputs need 44px tap targets. | Ensure preset buttons (`a4_24`, `a4_65`, `thermal`) have `min-h-[44px]` touch targets. |
| **Bulk Serial Import Modal** | `src/components/BulkSerialImportModal.tsx` (Lines 118–185) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-xl max-h-[90vh]` | Textarea + file dropzone fits well, but textarea needs auto-scroll on virtual keyboard. | Add `items-end sm:items-center p-0 sm:p-4`, `rounded-t-3xl sm:rounded-3xl`. |
| **Bulk Serial Manual Modal** | `src/components/BulkSerialModal.tsx` (Lines 47–110) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-lg rounded-3xl` | **HIGH RISK**: Missing `max-h-[90vh] overflow-y-auto`. Dual option tabs + textarea can overflow screen. | Add `max-h-[90vh] overflow-y-auto`, `items-end sm:items-center p-0 sm:p-4`. |
| **Recycle Bin Modal** | `src/components/RecycleBinModal.tsx` (Lines 115–210) | `fixed inset-0 z-50 flex items-center justify-center p-4` -> `max-w-4xl max-h-[90vh] flex flex-col` | Category tabs overflow horizontally; items list works well with `overflow-y-auto`. | Ensure category filter bar has `no-scrollbar` and smooth touch scrolling. |
| **Data Backup & Recovery Modal** | `src/components/DataBackupRecoveryModal.tsx` (Lines 210–360) | `fixed inset-0 z-[120] flex items-center justify-center p-4` -> `max-w-lg max-h-[90vh]` | Auto-backup record chips (`grid-cols-4`) squish on 320px; file upload dropzone is responsive. | Change chips to `grid-cols-2 sm:grid-cols-4 gap-2`. |
| **Setup Wizard Full-Screen Modal** | `src/components/SetupWizard.tsx` (Lines 240–420) | Full page overlay `fixed inset-0 z-[100] bg-white flex flex-col md:flex-row overflow-y-auto` | Left sidebar steps + right form: on mobile, left sidebar is hidden and top step badge shows (`Step 1 of 4`). Floating inputs work well. | Ensure floating labels do not overlap when autofilled on mobile Chrome/Safari. |
| **Demo Script & Guide Modal** | `src/components/DemoScriptModal.tsx` (Lines 30–120) | `fixed inset-0 z-[150] flex items-center justify-center p-4` -> `max-w-2xl max-h-[85vh]` | Long text content with audio tour. Has `overflow-y-auto`. | Add `items-end sm:items-center p-0 sm:p-4`, `rounded-t-3xl sm:rounded-3xl`. |
| **Command Palette Search Modal** | `src/App.tsx` (Lines 1184–1325) | `fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]` -> `max-w-xl max-h-[70vh]` | Top padding `pt-[12vh]` pushes modal down on mobile, reducing search result list height. | Change to `pt-4 sm:pt-[10vh]`, `max-h-[85vh] sm:max-h-[70vh]` on mobile. |
| **Floating User Profile Popover** | `src/App.tsx` (Lines 1103–1163) | `absolute right-0 top-14 max-sm:fixed max-sm:right-3 max-sm:top-14 w-64` | `max-sm:fixed max-sm:right-3` handles mobile viewport well. | Ensure `z-[9999]` and backdrop click dismisses cleanly. |
| **Checkout & UPI QR Modal** | `src/pages/Pricing.tsx` (Lines 585–680) | `fixed inset-0 z-[100] flex items-start justify-center p-2 pt-6 pb-6 overflow-y-auto xs:items-center sm:p-4` -> `max-w-lg lg:max-w-4xl max-h-[95vh]` | 2-column grid (`lg:grid-cols-12`) collapses to 1-column on mobile. Dynamic QR code resizes dynamically (`w-[150px]` on mobile). | Retain responsive layout, ensure copy button and inputs have `>= 44px` height. |

---

## 5. Settings Pages Audit

File: `src/pages/Settings.tsx` (Total lines: 1291)

`Settings.tsx` is structured into 10 distinct sections. Below is the responsive audit for each section:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SETTINGS SECTIONS RESPONSIVE AUDIT                                                              │
├────────────────────────────────┬────────────────────────────────┬────────────────────────────────┤
│ Section                        │ Current Grid Layout            │ Mobile Vulnerability (<768px)  │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 1. Business Profile            │ grid grid-cols-1 md:grid-cols-2│ Good responsive reflow; logo   │
│    (Name, Owner, Currency, Logo│                                │ upload button touch-friendly.  │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 2. Contact Details             │ grid grid-cols-1 md:grid-cols-3│ City/State/Pincode 3-column    │
│    (Phone, Email, City, State) │ for city/state/pin (Line 720)  │ grid collapses cleanly on md.  │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 3. Tax & Numbering             │ grid grid-cols-1 md:grid-cols-3│ Template radio cards wrap      │
│    (GSTIN, Prefix, Template)   │ (Line 765)                     │ into vertical stack.           │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 4. Payment Details (Invoices)  │ grid grid-cols-1 md:grid-cols-2│ Bank account fields stack      │
│    (UPI ID, Bank, Branch, IFSC)│ (Line 815)                     │ cleanly on mobile.             │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 5. Social Media & QR           │ grid grid-cols-1 md:grid-cols-2│ Social QR image dropzone       │
│    (Instagram, Facebook, QR)   │ (Line 885)                     │ is responsive.                 │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 6. Authorized Signature        │ Canvas / Upload area           │ Signature canvas fits within   │
│    (Draw / Image Upload)       │ (Line 960)                     │ card boundary; touch draw ok.  │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 7. Storage & Database Options  │ Single column toggles + PC     │ Toggle switches & Drive status │
│    (Offline Mode, PC Drive)    │ Drive cards (Line 995)         │ cards format cleanly.          │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 8. Automation & Backups        │ Toggle items (Line 1140)       │ Clean switch items.            │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 9. Subscription Receipts       │ 5-column table (Line 1202)     │ **Reflow Needed**: Convert to  │
│    (Receipt #, Date, Download) │ `<table className="w-full">`   │ touch cards on `<768px`.       │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────┤
│ 10. Danger Zone                │ Reset Data & Logout buttons    │ Full-width touch buttons       │
│    (Reset Database, Logout)    │ (Line 1255)                    │ (height >= 44px).              │
└────────────────────────────────┴────────────────────────────────┴────────────────────────────────┘
```

---

## 6. Verification, Build Status & Code Health

### 1. Build Verification:
- **Command executed**: `npm run build` (`vite build && esbuild server.ts ...`)
- **Result**: **SUCCESS** (Exit Code: 0)
- **Time**: 50.75s
- **Output Artifacts**:
  - `dist/index.html` (18.70 kB)
  - `dist/assets/index-B5xo6X8Y.css` (226.97 kB)
  - `dist/assets/index-D4WnFBaU.js` (1,082.79 kB)
  - `dist/server.cjs` (95.7 kB)
  - PWA service worker generated with 63 precached entries.

### 2. TypeScript & Code Health Audit:
- **Command executed**: `npx tsc --noEmit`
- **Result**: 1 pre-existing type mismatch identified:
  - **File**: `src/components/DataBackupRecoveryModal.tsx` (Line 318, Column 24)
  - **Error**: `TS2304: Cannot find name 'handleRestoreAutoBackup'.`
  - **Root Cause**: The restore handler function is defined as `handleAutoRestore` at line 128 of `DataBackupRecoveryModal.tsx`, but referenced as `handleRestoreAutoBackup` in the JSX button `onClick` at line 318.
  - **Remediation Note for Implementation Workers**: Update the button `onClick` from `handleRestoreAutoBackup` to `handleAutoRestore`.

### 3. Business Logic & Zero-Regression Invariants:
- All Firestore queries (`dbService`), offline encrypted cache (`cryptoUtils`), GST calculation algorithms, dynamic UPI string generators, and print engine stylesheets (`@media print`) must remain 100% untouched during responsive UI refactoring.
