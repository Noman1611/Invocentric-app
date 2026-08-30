## 2026-08-30T10:11:31Z

You are Worker 2 for Milestone 1: Viewport Shell, Safe-Area CSS & Navigation Shell (Iteration 2).
Your working directory is: E:\Original App\InvoCentic\.agents\m1_worker_2
Workspace root is: E:\Original App\InvoCentic

Read ORIGINAL_REQUEST.md at: E:\Original App\InvoCentic\ORIGINAL_REQUEST.md
Read PROJECT.md at: E:\Original App\InvoCentic\PROJECT.md
Read M1 Reviewer 1 handoff at: E:\Original App\InvoCentic\.agents\m1_reviewer_1\handoff.md
Read M1 Challenger 2 handoff at: E:\Original App\InvoCentic\.agents\m1_challenger_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
You own exclusively:
- `src/index.css`

TASK & REQUIRED FIX:
In `src/index.css` (lines 748–756), update the global border-radius override to wrap the selector list inside `:is(...)` before applying the `:not(...)` exclusion chain:

```css
/* Global Card & Container Border-Radius Override (Forces small, clean, uniform 12px corners across the entire application) */
:is(
  [class*="rounded-lg"],
  [class*="rounded-xl"],
  [class*="rounded-2xl"],
  [class*="rounded-3xl"],
  [class*="rounded-4xl"],
  [class*="rounded-["]
):not([class*="rounded-full"]):not([class*="rounded-t-"]):not([class*="rounded-b-"]):not([class*="rounded-l-"]):not([class*="rounded-r-"]):not([class*="rounded-[50%"]):not([class*="rounded-[9999px]"]) {
  border-radius: 12px !important;
}
```

VERIFICATION REQUIRED:
- Run `npx tsc --noEmit`
- Run `npm run build`
- Run `npm test` or `node tests/run-all-tests.mjs`
- Document commands and results in `E:\Original App\InvoCentic\.agents\m1_worker_2\handoff.md`.
- Send message to orchestrator when complete.
