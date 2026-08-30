## 2026-08-30T09:50:48Z

You are Explorer 1 for Milestone 1: Viewport Shell, Safe-Area CSS & Navigation Shell.
Your working directory is: E:\Original App\InvoCentic\.agents\m1_explorer_1
Workspace root is: E:\Original App\InvoCentic

Read ORIGINAL_REQUEST.md at: E:\Original App\InvoCentic\ORIGINAL_REQUEST.md
Read PROJECT.md at: E:\Original App\InvoCentic\PROJECT.md

OBJECTIVE:
Investigate exact changes needed for Milestone 1:
1. `index.html`: Update meta viewport with `interactive-widget=resizes-content` alongside `viewport-fit=cover`.
2. `src/index.css`:
   - Add `.pb-safe`, `.pt-safe`, `.pl-safe`, `.pr-safe`, `.mb-safe` utility classes using `env(safe-area-inset-*)`.
   - Refine the aggressive wildcard border-radius override (lines 748-756) to exclude directional classes (`:not([class*="rounded-t-"]):not([class*="rounded-b-"])`) so bottom sheets and drawers can have rounded-top corners without forcing bottom corners.
3. `src/components/MobileNav.tsx`:
   - Replace fixed `w-16` on tab items with fluid `flex-1 max-w-[68px]` to fit 320px screens perfectly without crunching.
   - Adjust nav height to dynamically incorporate safe area: `h-[calc(64px+env(safe-area-inset-bottom,0px))]`.
4. `src/App.tsx`:
   - Header actions on `< sm` viewports: collapse secondary buttons into drawer so 320px-360px screens don't overflow or crowd.
   - Main container padding: verify `pb-28` safe clearance above `MobileNav`.
5. `src/components/DataBackupRecoveryModal.tsx`:
   - Fix TS identifier error on line 318 (`handleRestoreAutoBackup` -> `handleAutoRestore`).

Produce exact code snippets and diff proposals for the Worker.
Write your analysis to `E:\Original App\InvoCentic\.agents\m1_explorer_1\analysis.md` and handoff to `E:\Original App\InvoCentic\.agents\m1_explorer_1\handoff.md`.
Send message to orchestrator when finished.
