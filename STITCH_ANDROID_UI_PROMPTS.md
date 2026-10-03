# InvoCentric — Stitch AI Android App UI Prompts & Design Guide

> **Target Tool**: Google Stitch / AI UI Generator  
> **Platform**: Android Mobile App (360px × 800px standard smartphone viewport)  
> **Theme Style**: Modern Indian FinTech (Clean, High-Trust, Emerald Green `#10B981` & Deep Slate `#0B0F19`, 16px Rounded Cards, Zero Clutter)

---

## 🎨 Global Stitch Master Style Prompt (Use this as your Base Style)

```text
Design a modern, premium Android mobile app interface for "InvoCentric" (GST Billing, POS & Accounting).
Visual Identity:
- Theme: Clean, minimal FinTech design similar to Razorpay, Cred, and Shopify POS.
- Color Palette: Primary Emerald Green (#10B981, #059669), Slate Navy Background (#F8FAFC in light / #0B0F19 in dark), Surface White (#FFFFFF / #111827), Slate Gray Text (#0F172A / #94A3B8).
- Semantic Colors: Paid/Success (#10B981), Unpaid/Alert (#EF4444), Pending/Warning (#F59E0B).
- Form Factor: Mobile screen (375x812 / 360x800) with Android status bar at top and home indicator at bottom.
- Typography: Inter or Outfit font, bold numbers for currency (₹ INR), scannable labels.
- Component Style: Rounded cards (rounded-2xl 16px), soft elevation shadows, 48px touch targets, sticky bottom action bar, and bottom navigation bar.
```

---

## 📱 Screen-by-Screen Stitch Prompts

---

### SCREEN 1: Splash & Login (`LoginPage`)
**Stitch Prompt**:
```text
Screen: Mobile Login & Authentication Screen for InvoCentric Android App.
Layout:
- Top: Subtle glowing emerald gradient background, centered modern InvoCentric vector logo with tagline "Smart GST Billing & POS".
- Main Content Card (Floating Surface):
  - Greeting: "Welcome Back" (H1 24px Bold), "Sign in to manage your business".
  - Primary Action: Official "Sign in with Google" button with Google logo icon, full width, 48px height, white background with subtle border.
  - Divider: Subtle line with "OR CONTINUE WITH EMAIL" in micro uppercase font.
  - Form Inputs: Floating outline input fields for "Business Email" and "Password" with an eye icon toggle.
  - Utilities: "Remember Me" checkbox and "Forgot Password?" link.
  - Secondary Action: "Sign In / Register" solid emerald green CTA button (#10B981).
- Bottom: Small footer text "By continuing you agree to Terms & Privacy Policy" with active cloud sync indicator pill "Offline-Ready • Safe & Encrypted".
```

---

### SCREEN 2: Home Dashboard (`Dashboard`)
**Stitch Prompt**:
```text
Screen: Android App Home Dashboard for InvoCentric.
Layout:
- Sticky Top Header:
  - Left: Store profile avatar + Store Name ("Sharma Electronics") with a green "Online Sync" dot.
  - Right: Quick Search icon button, Notification bell, and Profile avatar with "Pro Plan" gold badge.
- Date Range Chip: Pill selector showing "Today (24 Oct 2026) ▾".
- Top KPI Cards (2x2 Grid):
  - Card 1 (Sales): "Today's Sales" ₹18,450 (Large Bold Green), "+12% vs yesterday" micro chip.
  - Card 2 (Collections): "Received" ₹14,200 (UPI + Cash).
  - Card 3 (Due/Credit): "Customer Due" ₹4,250 (Red alert text).
  - Card 4 (Low Stock): "3 Items Low" with restock shortcut arrow.
- Quick Action Pills (Horizontal scrollable):
  - [+ Quick POS Sale] (Highlighted Emerald Pill)
  - [+ Create GST Invoice]
  - [+ Add Product]
  - [₹ Cash In/Out]
  - [WhatsApp Reminder]
- Sales Trend Mini Chart: Clean smoothed area chart showing weekly sales revenue.
- Recent Invoices Section:
  - Section title: "Recent Transactions" with "See All →" link.
  - List of 3 mobile cards: Customer Name (Bold), Invoice # pill, timestamp, Amount (₹2,499 in bold green), and a green WhatsApp share icon button.
- Bottom Navigation Bar (5 tabs): [Home (Active)], [Quick POS], [Invoices], [Items], [More].
```

---

### SCREEN 3: Quick POS Billing Counter (`QuickPOS`)
**Stitch Prompt**:
```text
Screen: Retail POS Quick Checkout Screen for Android Mobile.
Layout:
- Top Search Bar:
  - Full-width search input with barcode scanner camera button inside the search field.
  - Scan Barcode trigger button with camera icon.
- Category Filter Chips (Horizontal scroll):
  - [All (48)] (Active Emerald Pill), [Mobile Accessories], [Cables & Adapters], [Audio], [Smart Watches].
- Product Grid (2 Columns, Touch Cards):
  - Each Card: Product thumbnail image, Title ("Boat Airdopes 141"), Stock tag ("Stock: 24"), Selling Price ("₹1,299").
  - On Card Corner: Large "+" button to instantly add to cart with subtle haptic/bounce state.
- Sticky Floating Bottom Cart Bar (Collapsed state):
  - Elevated dark emerald pill floating above bottom nav:
  - Left: Shopping bag icon + "3 Items in Cart".
  - Middle: Total "₹3,450.00".
  - Right: "View Cart & Pay →" button.
```

---

### SCREEN 4: POS Cart & Instant Checkout Sheet (`QuickPOS Checkout Sheet`)
**Stitch Prompt**:
```text
Screen: Slide-up Bottom Sheet Modal for POS Cart & Checkout on Android.
Layout:
- Sheet Header: Drag handle pill at top, Title "Cart (3 Items)", Close "✕" icon.
- Customer Picker Card:
  - Searchable input for "Select Customer" with "+ New Customer" quick link.
- Cart Line Items List:
  - Item 1: "Boat Airdopes 141" | Unit: ₹1,299 | Stepper: [-] [ 2 ] [+] | Subtotal: ₹2,598 | Delete trash icon.
  - Item 2: "Type-C Fast Cable" | Unit: ₹299 | Stepper: [-] [ 1 ] [+] | Subtotal: ₹299 | Delete trash icon.
- Bill Summary Box:
  - Taxable Subtotal: ₹2,455.08
  - GST (18% - CGST 9% + SGST 9%): ₹441.92
  - Discount: [Input % or ₹]
  - Round Off: +₹0.00
  - Net Payable: ₹2,897.00 (Large 22px Bold font)
- Payment Mode Selector (4 Segmented Tabs):
  - [Cash] [UPI / Dynamic QR (Active)] [Card] [Credit / Khata]
- Big Primary Bottom Action Button:
  - Full-width emerald green button: "Collect ₹2,897 & Print Thermal Bill (⚡)"
```

---

### SCREEN 5: Create GST Invoice (`CreateInvoice`)
**Stitch Prompt**:
```text
Screen: Full GST Invoice Creation Screen for Android Mobile App.
Layout:
- Top App Bar: Back arrow "←", Title "Create Tax Invoice", "Draft" status pill, "Preview" icon.
- Step 1: Invoice Meta Card:
  - Invoice Number: "INV-2026-0042" (Editable prefix).
  - Invoice Date: Today's date picker.
  - Due Date picker.
- Step 2: Bill To Customer Card:
  - Customer selection with phone number, GSTIN, and billing address auto-filled.
  - Place of Supply dropdown: "27 - Maharashtra (Intra-State CGST+SGST)".
- Step 3: Line Items (Mobile Card Stack):
  - Card 1: "Samsung Galaxy A15 5G" | HSN: 8517 | Rate: ₹14,500 | Qty: 1 | Tax: 18% | Total: ₹17,110.
  - IMEI / Serial Number tag chip: "[IMEI: 864920194829102 ✕]".
  - "+ Add Another Item" dashed outline button.
  - "+ Scan Barcode" button.
- Step 4: Summary Card:
  - Subtotal, Tax Breakdown (CGST 9% + SGST 9%), Extra Discount input, Shipping Charges input.
  - Total Invoice Amount: ₹17,110.00.
  - "Advance Payment Received": Input ₹5,000.
  - "Balance Due": ₹12,110.00 (Red highlighted alert).
- Sticky Bottom Bar:
  - Left: "Due: ₹12,110" (Bold).
  - Right: Two action buttons: "[Save Draft]" (Outlined) and "[Save & Share WhatsApp]" (Solid Green).
```

---

### SCREEN 6: Invoices Directory (`Invoices`)
**Stitch Prompt**:
```text
Screen: Sales Invoices Management Screen for Android Mobile.
Layout:
- Top App Bar: Title "Sales Invoices", Search icon, Filter icon, "+ New Invoice" Floating Action Button.
- Filter Tabs (Segmented Control):
  - [All (142)] | [Unpaid (18)] | [Paid (114)] | [Overdue (10)]
- Quick Date Filter: "This Month (Oct 2026) ▾"
- Invoice Card Stack (List items):
  - Card 1:
    - Top Row: "INV-0042" (Bold) • "Today, 02:45 PM" • Green Pill "PAID".
    - Middle Row: Customer Name "Rahul Verma" (Phone: 98765-43210).
    - Items Summary: "3 Items • UPI Payment".
    - Bottom Row: Total "₹4,850.00" (Bold).
    - Actions Row: [WhatsApp Share] [Download PDF] [Print Receipt] [⋮ More].
  - Card 2:
    - Top Row: "INV-0041" • "Yesterday" • Red Pill "OVERDUE (₹3,200 Due)".
    - Middle Row: Customer Name "Kiran Stores" • Total "₹8,500.00".
    - Action: Highlighted green "Send WhatsApp Payment Reminder" button.
```

---

### SCREEN 7: Invoice View & Thermal Print (`InvoiceView`)
**Stitch Prompt**:
```text
Screen: Mobile Invoice Preview with Thermal & PDF options.
Layout:
- Top App Bar: Back arrow, "Invoice #INV-0042", Actions: [Bluetooth Printer Icon] [Share Icon].
- Format Selector Tabs:
  - [Thermal Receipt (58mm/80mm)] (Active) | [Standard A4 PDF]
- Thermal Receipt Paper Simulation Card (White paper texture with subtle jagged cut edges):
  - Store Header: "INVOCENTRIC STORE", Address, GSTIN: 27AAAAA0000A1Z5, Phone: 9820098200.
  - Receipt Meta: Date, Bill No #INV-0042, Cashier: Admin.
  - Dotted Divider line "--------------------------------".
  - Item Table:
    Item               Qty   Price    Total
    Boat Airdopes 141    2   1,299    2,598
    Type-C Cable         1     299      299
  - Dotted Divider line "--------------------------------".
  - Subtotal: ₹2,455.08
  - Total GST (18%): ₹441.92
  - GRAND TOTAL: ₹2,897.00 (Bold)
  - Dynamic UPI QR Code centered: "Scan & Pay via any UPI App".
  - Footer message: "Thank you for shopping! Visit Again."
- Sticky Bottom Action Bar:
  - [Print Thermal (Bluetooth)] (Large Emerald Button with Printer Icon)
  - [Share on WhatsApp] (Secondary Green Button)
```

---

### SCREEN 8: Items & Inventory Management (`Items`)
**Stitch Prompt**:
```text
Screen: Products & Inventory Management Screen for Android Mobile.
Layout:
- Top App Bar: Title "Inventory & Stock", Search Bar, Barcode Scanner icon.
- Sub-Navigation Tabs (Horizontal scrolling chips):
  - [Products (128)] (Active) | [Low Stock (5)] | [Stock Ledger] | [Serial Numbers] | [Categories]
- Product List Cards:
  - Card 1:
    - Left: Product Thumbnail image (60x60 rounded-xl).
    - Middle: "OnePlus Nord CE 4" | Category: Smartphones | SKU: OP-NORD-4.
    - Right / Pricing: "₹24,999" (MRP ₹26,999) | Margin: 12%.
    - Bottom Badge: Green Pill "In Stock: 18 Pcs".
  - Card 2:
    - "Apple 20W USB-C Adapter" | SKU: APL-20W.
    - Price: "₹1,890".
    - Bottom Badge: Red Alert Pill "Low Stock: 2 Pcs left" + "Restock (+)" button.
- Floating Action Button (FAB):
  - Round emerald button at bottom right with "+" icon to "Add New Product".
```

---

### SCREEN 9: Customer Khata & Ledger (`Customers`)
**Stitch Prompt**:
```text
Screen: Customer Directory & Khata Ledger for Android Mobile.
Layout:
- Top Header: Title "Customer Khata", Search customer input field.
- Summary Balance Bar:
  - Left: "You will Get (Due)" ₹48,250 (Red font).
  - Right: "You will Give (Advance)" ₹3,100 (Green font).
- Customer Khata List Cards:
  - Card 1:
    - Customer Name "Sunil Traders" (Wholesale).
    - Phone: 98111-22334 • Last purchase: 2 days ago.
    - Right Side: Balance "₹14,500 DUE" in red bold text.
    - Quick Action: WhatsApp icon button with pre-filled reminder template.
  - Card 2:
    - Customer Name "Amit Kumar" (Retail).
    - Right Side: Balance "₹0 (Settled)" in muted gray text.
- Floating Action Button: "+ Add Customer".
```

---

### SCREEN 10: Cash Book / DailyBook (`DailyBook`)
**Stitch Prompt**:
```text
Screen: Daily Cash Register & Daybook for Android Mobile.
Layout:
- Top Bar: Date picker showing "Today, 24 Oct 2026", "Day Book Summary".
- Daily Cash Balance Card (Emerald Gradient Card):
  - "Net Cash in Drawer": ₹12,850.00
  - Sub-metrics: Opening: ₹5,000 | In: +₹10,250 | Out: -₹2,400.
- Two Big Quick Action Buttons:
  - [+ Cash In (Received)] (Soft Green background, Green Plus)
  - [- Cash Out (Paid)] (Soft Red background, Red Minus)
- Transaction Timeline List:
  - Item 1: "Cash Sale - INV-0042" • 02:45 PM • Green "+₹2,897.00".
  - Item 2: "Tea & Snacks Expense" • 11:30 AM • Red "-₹150.00".
  - Item 3: "Customer Payment (Ramesh)" • 10:15 AM • Green "+₹1,500.00".
- Bottom CTA: "Reconcile & Close Day Book" button.
```

---

### SCREEN 11: Settings & Bluetooth Printer Pairing (`Settings`)
**Stitch Prompt**:
```text
Screen: Settings & Hardware Integration Screen for Android Mobile.
Layout:
- Top App Bar: Title "App Settings", Back button.
- Section 1: Business Profile Card:
  - Store Logo, "Sharma Electronics", GSTIN, Edit Profile button.
- Section 2: Hardware & Printing:
  - "Bluetooth Thermal Printer": Status "Connected to POS-58" (Green dot).
  - "Paper Width": Toggle between [58mm (2 Inch)] and [80mm (3 Inch)].
  - "Print Test Receipt" button.
  - "Auto-Print Bill on Save": Switch toggle (ON).
- Section 3: Billing & Taxes:
  - "GST Slabs", "Invoice Number Prefix", "UPI QR ID".
- Section 4: Data & Backup:
  - "Storage Mode": Cloud Firestore (Synced) / Local IndexedDB.
  - "Backup Data to JSON" button.
- Section 5: App Version info:
  - "InvoCentric Android App v1.0.38 (Latest)" with checkmark.
```

---

## 💡 Stitch Design Tips & Best Practices

1. **Hierarchy**: Always specify the **Title**, **Primary Metric**, and **Primary Action Button** so Stitch knows what to emphasize.
2. **Icons**: Mention icons explicitly (e.g. `barcode scanner icon`, `printer icon`, `WhatsApp icon`).
3. **Contrast**: Use `#10B981` (Emerald) for positive actions/paid status, and `#EF4444` (Rose/Red) for debts/unpaid amounts to give authentic Indian accounting app clarity (like Khatabook / Vyapar / myBillBook).
4. **Touch targets**: Always include a sticky bottom action bar on transactional screens (`CreateInvoice`, `QuickPOS`, `InvoiceView`) so it feels like a native Android app designed for one-handed thumb use.
