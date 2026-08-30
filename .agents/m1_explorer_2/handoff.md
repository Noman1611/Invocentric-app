# Handoff Report — Milestone 1: Navigation Shell & Viewport Ergonomics

## 1. Observation

### 1.1 MobileNav (`src/components/MobileNav.tsx`)
- **Lines 74, 115, 129**: Bottom nav item class names use fixed `w-16 h-14`:
  ```tsx
  className={cn(
    "flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-2xl transition-all",
    isActive ? "text-green-600" : "text-neutral-400"
  )}
  ```
- **Line 64**: Fixed height `h-[68px] pb-safe`:
  ```tsx
  <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden print:hidden h-[68px] pb-safe flex items-center justify-between px-2 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg shadow-slate-900/5">
  ```
- **Lines 74, 115, 129**: NavLinks have `transition-all` but omit `active:scale-95`.
- **Line 171**: Drawer close button has `p-2` (~34px tap boundary):
  ```tsx
  <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full active:scale-95 transition-colors bg-neutral-100 text-neutral-600">
  ```
- **Line 155, 176**: Bottom sheet drawer container lacks `pb-safe` for iOS home indicator bar clearance:
  ```tsx
  <motion.div ... className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-[70] max-h-[85vh] flex flex-col bg-white">
  <div className="overflow-y-auto px-4 py-4 space-y-2 pb-8 custom-scrollbar">
  ```

### 1.2 Sidebar (`src/components/Sidebar.tsx`)
- Enclosed in `hidden md:block print:hidden` in `src/App.tsx:791`.
- Navigation active states correctly use `({ isActive }) => cn(...)` with `bg-[#F0FDF4] text-[#166534]`.
- All routes (`/invoices`, `/quotations`, `/customers`, `/items`, `/dailybook`, `/purchases`, `/expenses`, `/reports`, `/admin`, `/pricing`, `/settings`) and modes (`shop` / `freelancer`) are fully intact.

### 1.3 App Header & Shell (`src/App.tsx`)
- **Lines 820–937**: Header contains Logo, Search (desktop), Mode Pill, Phone Scanner Button, App Guide Button, Notification Bell, and Profile Dropdown Pill.
- **Lines 861, 877**: Phone Scanner and App Guide buttons are visible on mobile; collapsing them with `hidden sm:flex` leaves 4 primary header elements (Logo, Mode, Bell, Profile) taking ~190px on 320px width.
- **Line 1166**: Main scroll container has `pb-28 md:pb-10`, providing 112px bottom clearance.

### 1.4 TypeScript Error & CSS Rules
- **TypeScript Error in `src/components/DataBackupRecoveryModal.tsx:318`**:
  ```
  src/components/DataBackupRecoveryModal.tsx(318,24): error TS2304: Cannot find name 'handleRestoreAutoBackup'.
  ```
  Function is defined on line 128 as `handleAutoRestore`.
- **`src/index.css`**: `.pb-safe`, `.pt-safe`, `.pl-safe`, `.pr-safe`, `.mb-safe` are missing.
- **`src/index.css:748-756`**: Wildcard border-radius rule overrides `.rounded-t-3xl` on bottom sheets.
- **`index.html:79`**: Missing `interactive-widget=resizes-content` on viewport meta tag.

---

## 2. Logic Chain

1. **Step 1 (Viewport Width Math)**: 
   On a 320px screen, 4 fixed items of $64\text{px}$ width plus $64\text{px}$ FAB plus $16\text{px}$ container padding totals $336\text{px}$. Because $336\text{px} > 320\text{px}$, replacing `w-16` with `flex-1 max-w-[68px] min-w-0` guarantees that items flex-shrink to $\approx 60\text{px}$, which is $< 320\text{px}$ total and $\ge 44\text{px}$ minimum touch target.
2. **Step 2 (Touch Ergonomics)**:
   Adding `active:scale-95` to bottom nav items and expanding the drawer close button to $\ge 44\text{px}$ fulfills mobile touch responsiveness requirements without affecting link routing.
3. **Step 3 (Safe-Area & Sheet Clipping)**:
   Defining `.pb-safe` utilities in `src/index.css`, exempting directional radius classes (`rounded-t-*`), and adding `pb-safe pb-10` to the drawer ensures bottom sheet menus do not clip against device home indicator bars.
4. **Step 4 (Header Layout Stability)**:
   On 320px viewports, collapsing secondary header buttons to `hidden sm:flex` reserves 130px of breathing room for logo, mode pill, bell, and profile avatar, preventing wrapping or overflow while retaining full feature access via dropdowns.
5. **Step 5 (Zero Logic Regression & Build Stability)**:
   Correcting the identifier typo `handleRestoreAutoBackup` $\rightarrow$ `handleAutoRestore` eliminates the sole compilation blocker in `tsc --noEmit`. No business logic, Firestore queries, or routing parameters are modified.

---

## 3. Caveats

- **No Caveats**: All component structures, responsive breakpoints, touch target dimensions, and routing behaviors across `MobileNav.tsx`, `Sidebar.tsx`, `App.tsx`, and `DataBackupRecoveryModal.tsx` were directly inspected and verified against the codebase.

---

## 4. Conclusion

Milestone 1 navigation and viewport shell requirements are clearly scoped, actionable, and ready for worker implementation:
1. Update `MobileNav.tsx`: Fluid `flex-1 max-w-[68px] min-w-0`, `active:scale-95`, `min-h-[68px] pb-safe`, drawer `pb-safe` & close button touch target.
2. Update `App.tsx`: Header button responsiveness (`hidden sm:flex` for guide/scanner on small screens), clean spacing.
3. Update `src/index.css`: Add safe-area utilities (`.pb-safe`, etc.) and exempt directional classes from wildcard border radius.
4. Update `index.html`: Add `interactive-widget=resizes-content`.
5. Update `DataBackupRecoveryModal.tsx`: Fix `handleRestoreAutoBackup` $\rightarrow$ `handleAutoRestore`.

---

## 5. Verification Method

1. **Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```
   Must exit with 0 errors.
2. **Viewport Overflow & Sizing Inspection**:
   - Inspect `MobileNav.tsx` at 320px width to ensure zero horizontal scroll and fluid item distribution.
   - Inspect drawer sheet at 320px–414px to confirm `rounded-t-3xl` is intact and bottom items are not clipped.
3. **Touch Targets**:
   - Check all bottom nav items and drawer buttons maintain $\ge 44\text{px}$ touch boundary and `active:scale-95` tactile response.
4. **Zero Logic Regression**:
   - Verify all routes (`/invoices`, `/quotations`, `/customers`, `/items`, `/dailybook`, etc.) transition without error.
