# Original User Request

## Initial Request — 2026-08-30T09:20:27Z

Comprehensive responsive UI overhaul for InvoCentic to deliver a polished, native-like mobile app experience on smartphones (320px–414px) and a clean desktop webapp layout across all pages, modals, tables, POS, and settings without altering existing business logic or data.

Working directory: E:\Original App\InvoCentic
Integrity mode: development

## Requirements

### R1. Comprehensive Responsive Layout & Viewport Protection
All application views (Dashboard, Invoices, Create/Edit Invoice, Customers, Items/Inventory, QuickPOS, Expenses, Purchases, Reports, Settings, DailyBook, Payments, Modals, Popups, and Drawers) must adapt responsively from 320px width up to desktop screens. No text, button, card, or menu may cause page-level horizontal overflow or suffer from clipping.

### R2. Native Mobile Touch Ergonomics & Card Reflow
- Convert dense data tables on mobile (<768px) into fluid touch-friendly card layouts or smooth touch-scroll containers with clear sticky actions.
- Optimize modal dialogs and bottom sheets for thumb reach with proper touch dismissals, rounded-top sheets, and scrollable bodies.
- Add active touch feedback (micro-haptics / scale animations) to mobile action triggers and buttons.
- Ensure tap targets meet the 44px standard with adequate spacing to prevent accidental taps.

### R3. Safe-Area Navigation Clearance
Enforce consistent clearance above the mobile bottom navigation bar (pb-24 / pb-safe) across all scrollable route containers so action buttons and footer contents are never occluded.

### R4. Zero Regressions on Logic & Brand Identity
Maintain all existing business logic, Firestore queries, offline caching, GST computations, print/PDF rendering engines, and brand visual styling (colors, typography, icons).

## Acceptance Criteria

### Viewport & Layout
- [ ] No horizontal page scrolling (document.body.scrollWidth === window.innerWidth) on 320px, 360px, 375px, 390px, 414px, 768px, 1024px, and 1440px.
- [ ] Modals, drawers, and floating menus open cleanly within the visible viewport on mobile without clipping header or action buttons.

### Mobile Usability & Navigation
- [ ] Main scroll containers maintain bottom clearance above the mobile navigation bar.
- [ ] Buttons and touch targets have at least 44px touch area and responsive active feedback.
- [ ] Tabular data (Invoices, Items, Customers, DailyBook) is legible and easily navigable on small screens.

### Build & Functionality
- [ ] 
px vite build executes successfully with 0 compilation errors.
- [ ] All invoice generation, POS checkout, customer management, and settings save flows remain fully functional.
