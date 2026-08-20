# BillCraft: Enterprise SaaS Application Blueprint

This document serves as the master architectural prompt and design specification for the **BillCraft** application. Use this blueprint to replicate or extend the application with high-fidelity consistency.

## 1. Core Identity & Mood
- **Brand Name:** BillCraft
- **Niche:** Enterprise Financial Management (Invoices, Quotations, Inventory, Client Relations)
- **Vibe:** Professional, Modern SaaS, Minimalist yet Data-Rich.
- **Design Philosophy:** "Swiss-Style Precision". Focus on high-contrast typography, generous whitespace (40px+ between logic blocks), and rounded architectural elements (24px to 40px radius).

## 2. Visual Specification (Tailwind CSS)

### Color Palette
- **Primary (Teal):** `bg-[#0D635D]` (Deep Emerald) for primary actions.
- **Surface (Slate):** `bg-slate-50` for backgrounds, `border-slate-100` for subtle dividers.
- **Text:** `text-slate-900` for headers, `text-slate-400` for secondary metadata.
- **Accents:** `rose-600` for alerts/deletes, `teal-600` for success/active states.

### Typography
- **Primary Sans:** `Inter` (ui-sans-serif) - used for all functional UI and body text.
- **Display Sans:** `Space Grotesk` - used for prominent headings and numeric titles to give a "tech-forward" feel.
- **Styling Traits:** High use of `italic` for headings to convey forward momentum. Use of `uppercase tracking-widest` for small label metadata.

### Components
- **Cards (`.card-base`):** `bg-white border border-slate-100 rounded-[2.5rem] shadow-sm`.
- **Buttons (`.btn-primary`):** `bg-[#0D635D] text-white rounded-2xl font-bold transition-all active:scale-95`.
- **Inputs (`.input-field`):** `bg-slate-50 border-transparent rounded-2xl px-5 py-4 focus:bg-white focus:border-teal-500 transition-all`.

## 3. Page Architectures

### Dashboard (Bento-Grid Layout)
- Use a 4-column heterogeneous grid.
- Featured stats use `italic` headings and bold icons.
- Activity feed is integrated as a vertical stream.

### Financial Ledger (Invoices)
- Header with "High-Contrast" stats.
- Table-first view with row-hover states (`hover:bg-slate-50/50`).
- Status badges use the "Subtle Background + Bold Text" pattern (e.g., `bg-teal-50 text-teal-700`).

### Client Directory (Customers)
- Grid of cards by default.
- Each card displays primary business contact info with a "Profile Glow" (bg-slate-50).

### Inventory Ledger (Items)
- Hybrid Grid/List view toggle.
- Low-stock alerts use a "Soft Red" notification pattern with subtle animations (`animate-pulse`).

## 4. Technical Stack
- **Framework:** React 18+ (Vite)
- **Styling:** Tailwind CSS 4.0+
- **Database/Auth:** Firebase (Firestore + Auth)
- **Animations:** Motion (Framer Motion)
- **Icons:** Lucide-React
- **State Management:** React Context (AuthContext)

## 5. Mobile Protocol
- **Navigation:** Persistent bottom navigation bar with a central "FAB" (Floating Action Button) for creation tasks.
- **Menus:** Swipeable drawer-style side menu for secondary settings and tools.
- **Interactions:** Use `active:scale-95` on all tactile elements to provide haptic-like visual feedback.

## 6. Logic Patterns
- **Offline First:** LocalStorage mirroring for core datasets (Items, Customers) to ensure continuity without internet.
- **Real-Time:** Firestore `onSnapshot` for high-frequency updates (Admin feed, Dashboard stats).
- **Error Handling:** Standardized `handleFirestoreError` logic that stringifies Auth context for debug transparency.
