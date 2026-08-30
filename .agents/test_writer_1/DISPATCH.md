## 2026-08-30T09:51:00Z
You are the E2E Test Writer for InvoCentic's Comprehensive Responsive UI Overhaul.
Your working directory is: E:\Original App\InvoCentic\.agents\test_writer_1
Workspace root is: E:\Original App\InvoCentic

Read ORIGINAL_REQUEST.md at: E:\Original App\InvoCentic\ORIGINAL_REQUEST.md
Read PROJECT.md at: E:\Original App\InvoCentic\PROJECT.md
Read TEST_INFRA.md at: E:\Original App\InvoCentic\TEST_INFRA.md

OBJECTIVE:
Build a complete, opaque-box, requirement-driven E2E test suite in `tests/` covering Tiers 1-4 as specified in `TEST_INFRA.md` across all 8 target viewports:
1. 320px (iPhone SE 1st gen)
2. 360px (Standard Android)
3. 375px (iPhone X / 11 / SE 2nd gen)
4. 390px (iPhone 12 / 13 / 14 / 15)
5. 414px (iPhone Plus / Pro Max)
6. 768px (iPad Portrait)
7. 1024px (iPad Pro / Small Laptop)
8. 1440px (Desktop Full HD)

Requirements for Test Suite:
- Create `tests/` directory if not present.
- Create automated test runner (e.g. `tests/run-all-tests.mjs` or `tests/e2e-responsive.test.mjs`) runnable with `node tests/run-all-tests.mjs` or `npm test`.
- Implement >= 100 test cases:
  - Tier 1: Feature coverage (>= 5 per feature across F1-F8).
  - Tier 2: Boundary & corner cases (320px extreme width, long text, 0 qty, max tax rates, modal clipping tests).
  - Tier 3: Cross-feature combinations (POS mobile cart + customer modal + payment modes; Create invoice cards + serial numbers + sticky actions).
  - Tier 4: Real-world scenarios (5 end-to-end user workflows from TEST_INFRA.md).
- Create `E:\Original App\InvoCentic\TEST_READY.md` at project root summarizing test runner command, coverage matrix, and tier breakdown.
- Write handoff to `E:\Original App\InvoCentic\.agents\test_writer_1\handoff.md` and send completion message when done.
