## 2026-08-30T09:56:50Z

You are the Worker for Milestone 1: Viewport Shell, Safe-Area CSS & Navigation Shell.
Your working directory is: E:\Original App\InvoCentic\.agents\m1_worker_1
Workspace root is: E:\Original App\InvoCentic

Read ORIGINAL_REQUEST.md at: E:\Original App\InvoCentic\ORIGINAL_REQUEST.md
Read PROJECT.md at: E:\Original App\InvoCentic\PROJECT.md
Read M1 Explorer 1 handoff at: E:\Original App\InvoCentic\.agents\m1_explorer_1\handoff.md
Read M1 Explorer 3 handoff at: E:\Original App\InvoCentic\.agents\m1_explorer_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
You own exclusively:
- `index.html`
- `src/index.css`
- `src/components/MobileNav.tsx`
- `src/App.tsx`
- `src/components/DataBackupRecoveryModal.tsx`

OBJECTIVE & REQUIRED IMPLEMENTATION:
1. `index.html`:
   - Update meta viewport (line 79) to:
     `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content" />`
2. `src/index.css`:
   - Add safe-area utility classes:
     ```css
     .pt-safe { padding-top: env(safe-area-inset-top, 0px); }
     .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
     .pl-safe { padding-left: env(safe-area-inset-left, 0px); }
     .pr-safe { padding-right: env(safe-area-inset-right, 0px); }
     .p-safe {
       padding-top: env(safe-area-inset-top, 0px);
       padding-bottom: env(safe-area-inset-bottom, 0px);
       padding-left: env(safe-area-inset-left, 0px);
       padding-right: env(safe-area-inset-right, 0px);
     }
     .mt-safe { margin-top: env(safe-area-inset-top, 0px); }
     .mb-safe { margin-bottom: env(safe-area-inset-bottom, 0px); }
     .ml-safe { margin-left: env(safe-area-inset-left, 0px); }
     .mr-safe { margin-right: env(safe-area-inset-right, 0px); }
     ```
   - Add scrollbar utilities:
     ```css
     .no-scrollbar::-webkit-scrollbar { display: none; }
     .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
     ```
   - Refine the wildcard border-radius override (lines ~748-756) so it does NOT affect directional classes (e.g. `rounded-t-*`, `rounded-b-*`, `rounded-l-*`, `rounded-r-*`):
     ```css
     [class*="rounded-lg"],
     [class*="rounded-xl"],
     [class*="rounded-2xl"],
     [class*="rounded-3xl"],
     [class*="rounded-4xl"],
     [class*="rounded-["]:not([class*="rounded-full"]):not([class*="rounded-t-"]):not([class*="rounded-b-"]):not([class*="rounded-l-"]):not([class*="rounded-r-"]):not([class*="rounded-[50%"]):not([class*="rounded-[9999px]"]) {
       border-radius: 12px !important;
     }
     ```
3. `src/components/MobileNav.tsx`:
   - Replace fixed `w-16` on tab items with fluid `flex-1 max-w-[68px] min-w-0` to fit 320px screens perfectly without crunching.
   - Use dynamic safe-area height: `className="fixed bottom-0 left-0 right-0 z-50 md:hidden print:hidden h-[calc(64px+env(safe-area-inset-bottom,0px))] pb-safe flex items-center justify-between px-2 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg shadow-slate-900/5"`
   - Ensure the mobile bottom menu drawer includes safe padding (`pb-safe`) and proper scroll/height bounds.
4. `src/App.tsx`:
   - Header actions on `< sm` viewports: add `hidden sm:flex` to secondary header buttons (`Global Phone Scanner Connect Button` and `Product Guide & Audio Tour Button`) so the header on 320px-360px phones only displays the Mode toggle, Notification Bell, and Profile Avatar, completely preventing overflow.
   - In the mobile user profile menu / drawer in `App.tsx`, ensure the Phone Scanner option is available so mobile users retain 100% access.
   - Verify main scroll container has `pb-28 md:pb-10` for safe clearance over `MobileNav`.
5. `src/components/DataBackupRecoveryModal.tsx`:
   - Fix line 318: change `onClick={handleRestoreAutoBackup}` to `onClick={handleAutoRestore}`.

VERIFICATION REQUIRED:
- Run `npx tsc --noEmit` -> Must pass with 0 errors.
- Run `npx vite build` -> Must pass with 0 compilation errors.
- Document commands and results in `E:\Original App\InvoCentic\.agents\m1_worker_1\handoff.md`.
- Send message to orchestrator when finished.
