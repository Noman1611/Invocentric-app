## 2026-08-30T09:23:46Z
Investigate all data management views, tables, lists, detail views, modals/dialogs, drawers, and settings screens across InvoCentic.
Specifically identify:
1. All tabular pages: Invoices List, Estimates/Quotations, Items/Inventory List, Customers/Parties/Vendors List, DailyBook / CashBook / Expenses, Reports / Analytics, Audit Logs / Activity.
2. Current table implementations: Look for `<table>`, `overflow-x-auto`, fixed column widths, action menus, filtering/search toolbars, pagination, batch actions.
3. Mobile reflow requirements (<768px): How each table should reflow into touch-friendly cards with badges, primary/secondary fields, quick-action swipe/tap menus, or touch-scroll containers without breaking page width.
4. All Modals, Dialogs, Drawers, and Floating Popovers across the app: Customer add/edit modal, Item add/edit modal, Payment collection modal, Filter drawers, Settings tabs/dialogs, Confirmation alerts.
   - Identify viewport clipping issues on 320px–414px (fixed widths `w-[500px]`, missing `max-h-[90vh] overflow-y-auto`, missing mobile rounded-top bottom sheet styling).
5. Settings pages: Company Profile, GST/Tax Settings, Invoice Templates / Print Config, User Management, Backup / Sync.
6. Verification & build status: Check package.json test scripts, verify how tests or build are executed.
