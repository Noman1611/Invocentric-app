# E2E Test Infra: InvoCentic Responsive UI Overhaul

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Derived strictly from `ORIGINAL_REQUEST.md` and user-facing acceptance criteria.
- **Viewport Testing Matrix**: All tests are evaluated across 8 viewport dimensions:
  1. 320px (iPhone SE 1st gen / small smartphones)
  2. 360px (Standard Android / Galaxy S series)
  3. 375px (iPhone X / 11 / SE 2nd gen)
  4. 390px (iPhone 12 / 13 / 14 / 15)
  5. 414px (iPhone Plus / Pro Max)
  6. 768px (iPad Portrait / Tablet)
  7. 1024px (iPad Pro Landscape / Small Laptop)
  8. 1440px (Desktop Full HD / Wide monitor)
- **Methodology**: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial Testing + Real-World Workload Testing.

---

## Feature Inventory & Test Matrix

| # | Feature Area | Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross) | Tier 4 (Scenario) |
|---|--------------|--------|:----------------:|:-----------------:|:--------------:|:-----------------:|
| F1 | Viewport Overflow (`scrollWidth === innerWidth`) | R1 | 5 | 5 | ✓ | ✓ |
| F2 | Navigation Shell & Safe-Area Clearance (`pb-28`, `pb-safe`) | R3 | 5 | 5 | ✓ | ✓ |
| F3 | Touch Targets (>= 44px) & Active Feedback | R2 | 5 | 5 | ✓ | ✓ |
| F4 | POS & Quick Billing Mobile Reflow | R2 | 5 | 5 | ✓ | ✓ |
| F5 | Create/Edit Invoice Responsive Form & Item Cards | R1, R2 | 5 | 5 | ✓ | ✓ |
| F6 | Tabular Data Reflow (Invoices, DailyBook, etc.) | R2 | 5 | 5 | ✓ | ✓ |
| F7 | Modals & Bottom Sheets (`max-h-[94vh]`, No Clipping) | R2 | 5 | 5 | ✓ | ✓ |
| F8 | Zero Regressions on Business Logic & Calculations | R4 | 5 | 5 | ✓ | ✓ |

---

## Test Architecture & Runner

- **Runner**: Node.js / Playwright / automated headless browser / Vite build verification script.
- **Location**: `tests/`
- **Invocation**: `npm test` or `node tests/run-all-tests.mjs`
- **Pass/Fail Semantics**: Exit code 0 on 100% pass across all 8 viewports.

---

## Real-World Application Scenarios (Tier 4)

1. **Scenario 1 - Complete POS Retail Sale on 320px Screen**:
   Open POS on 320px viewport -> Search product -> Adjust quantity via touch steppers -> Open mobile cart sheet -> Select customer & payment mode (UPI/Cash) -> Confirm sale -> Verify stock reduction & receipt.
2. **Scenario 2 - Complex GST B2B Invoice Creation on 375px Screen**:
   Open Create Invoice on 375px viewport -> Select customer from autocomplete (zero overflow) -> Add 3 line items with GST/Discounts via responsive item cards -> Toggle serial number drawer -> Save invoice -> Verify zero horizontal scrolling and safe navigation clearance.
3. **Scenario 3 - DailyBook Ledger Reconciliation on 390px Screen**:
   Open DailyBook on 390px viewport -> View mobile summary cards -> Toggle touch-scroll ledger container -> Filter date range -> Verify legible amounts and export buttons without viewport clipping.
4. **Scenario 4 - Inventory Management & Modal Editing on 414px Screen**:
   Open Items list on 414px viewport -> Search item -> Open edit modal (renders as rounded bottom sheet with drag handle) -> Edit price and reorder level -> Save -> Verify modal dismisses cleanly without clipping.
5. **Scenario 5 - Desktop to Mobile Seamless Transition (1440px -> 768px -> 360px)**:
   Resize viewport across all breakpoints -> Verify sidebar collapses to mobile bottom nav, multi-column tables reflow cleanly into cards, and `document.body.scrollWidth === window.innerWidth` holds at every single width.

---

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: >= 40 test cases (>= 5 per feature area)
- **Tier 2 (Boundary & Corner Cases)**: >= 40 test cases (320px edge cases, long text, 0 qty, max tax rates, keyboard open)
- **Tier 3 (Cross-Feature Combinations)**: >= 15 test cases (POS cart + modal + offline queue; Invoice cards + customer autocomplete + thermal print)
- **Tier 4 (Real-World Scenarios)**: >= 5 end-to-end application scenarios
- **Total Test Cases**: >= 100 test cases
