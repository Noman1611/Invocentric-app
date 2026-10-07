# InvoCentric Brand Color System Rules

## Strict Policy: Zero Purple & Zero Blue
1. **Never use Purple (`purple-*`) or Blue (`blue-*`) in any component or page.**
2. When creating or modifying UI components, only use the official InvoCentric brand palette:
   - **Primary Brand (Forest Green & Emerald):** `#166534` (`bg-[#166534]`, `text-[#166534]`), `#0d5c4b`, `emerald-600` (`#059669`), `emerald-50` (`#f0fdf4`).
   - **Accent / Badges (Amber & Gold):** `#f59e0b` (`amber-500`), `#92400e` (`amber-800`), `amber-100` (`#fef3c7`). Replaces all purple badges (e.g. "PRO", "SaaS").
   - **Critical / Danger (Crimson Rose):** `rose-600` (`#e11d48`), `rose-50` (`#fff1f2`).
   - **Surfaces & Neutrals (Charcoal Slate):** `slate-900` (`#0f172a`), `slate-600`, `slate-200`, `slate-50`, `white`. Replaces all blue info cards and chips.
3. Every new component must reference `src/constants/brandColors.ts`.
