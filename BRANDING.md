# InvoCentric — Brand Identity & SVG Logo Assets

> **InvoCentric** official branding guidelines, color palette, typography, and production-ready vector SVG codes.

---

## 📌 Brand Overview

- **Brand Name:** InvoCentric
- **Display Typography:** `Invo` (Font-Black) + `Centric` (Font-Bold)
- **Tagline:** Free GST Billing Software & Inventory Management
- **Domain:** [https://invocentric.in/](https://invocentric.in/)
- **Core Theme:** Trustworthy, modern, clean, and fast financial software for Indian retail, wholesale, and MSME businesses.

---

## 🎨 Official Color Palette

| Color Name | HEX | RGB | HSL | Role / Usage |
| :--- | :--- | :--- | :--- | :--- |
| **InvoCentric Deep Teal** | `#0F645D` | `rgb(15, 100, 93)` | `hsl(175°, 74%, 23%)` | **Primary Brand Color** (Logo background, primary buttons, brand accents) |
| **Teal Light / Tint** | `#E6F3EE` | `rgb(230, 243, 238)` | `hsl(157°, 33%, 93%)` | Secondary light backgrounds, badges, hover accents |
| **Forest Accent** | `#166534` | `rgb(22, 101, 52)` | `hsl(143°, 64%, 24%)` | Success highlights, Enterprise badge text |
| **Dark Slate (Primary Text)** | `#0F172A` | `rgb(15, 23, 42)` | `hsl(222°, 47%, 11%)` | Primary headings, dark mode surfaces |
| **Muted Slate** | `#4F5B66` | `rgb(79, 91, 102)` | `hsl(209°, 13%, 35%)` | Secondary body text, sidebar links |
| **Pure White** | `#FFFFFF` | `rgb(255, 255, 255)` | `hsl(0°, 0%, 100%)` | Contrast mark fill, card backgrounds |

---

## 🖋️ Typography

- **Primary Font:** `Inter`, system-ui, -apple-system, sans-serif
- **Monospace (Numbers & Invoice Data):** `JetBrains Mono` / `Roboto Mono`
- **Handwritten / Signatures:** `Caveat`

---

## 📐 Logo SVG Codes

### 1. Official Circular Badge (Default Brand Icon)
> Use for avatars, social media profiles, web headers, and PWA icons.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="240" fill="#0F645D" />
  <g transform="translate(256, 256) scale(0.78) translate(-250, -250)">
    <path fill="#FFFFFF" d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z" />
    <ellipse fill="#FFFFFF" cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
    <path fill="#FFFFFF" d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z" />
  </g>
</svg>
```

---

### 2. Transparent Vector Mark (Brand Teal Color `#0F645D`)
> Pure vector glyph without background circle. Ideal for transparent layouts, documents, and custom containers.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <g fill="#0F645D">
    <!-- Outer Crescent Arc -->
    <path d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
    <!-- Top-Right Accent Dot -->
    <ellipse cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
    <!-- Inner Dynamic Check-Mark -->
    <path d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z"/>
  </g>
</svg>
```

---

### 3. Full Horizontal Brand Lockup (Logo + Wordmark + Tagline)
> Perfect for website headers, invoice letterheads, partner presentations, and documentation.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width="520" height="120">
  <!-- Brand Icon Badge -->
  <g transform="translate(10, 10)">
    <circle cx="50" cy="50" r="48" fill="#0F645D" />
    <g transform="translate(50, 50) scale(0.155) translate(-250, -250)" fill="#FFFFFF">
      <path d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
      <ellipse cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
      <path d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z"/>
    </g>
  </g>
  
  <!-- Wordmark Text -->
  <text x="122" y="66" font-family="'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" font-size="44" letter-spacing="-1">
    <tspan fill="#0F172A" font-weight="900">Invo</tspan><tspan fill="#0F645D" font-weight="700">Centric</tspan>
  </text>
  
  <!-- Subtitle Tagline -->
  <text x="124" y="92" font-family="'Inter', system-ui, sans-serif" font-size="11" font-weight="800" fill="#166534" letter-spacing="3" text-transform="uppercase">
    FREE GST BILLING &amp; INVENTORY
  </text>
</svg>
```

---

### 4. Modern Squircle App Icon (Android / Desktop App style)
> Rounded rectangle icon with soft elevation styling.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="invocentric-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#13776F" />
      <stop offset="100%" stop-color="#0F645D" />
    </linearGradient>
  </defs>
  <!-- Squircle Base -->
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#invocentric-bg)" />
  <!-- Vector Mark -->
  <g transform="translate(256, 256) scale(0.72) translate(-250, -250)" fill="#FFFFFF">
    <path d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
    <ellipse cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
    <path d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z"/>
  </g>
</svg>
```

---

### 5. Maskable SVG Icon (Safe-Zone Compliant for Android PWA)
> Matches `public/logo-maskable.svg` with 20% safe-padding around the perimeter.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="195" fill="#0F645D" />
  <g transform="translate(256, 256) scale(0.72) translate(-250, -250)">
    <path fill="#FFFFFF" d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z" />
    <ellipse fill="#FFFFFF" cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
    <path fill="#FFFFFF" d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z" />
  </g>
</svg>
```

---

### 6. Monochrome White Icon (For Dark Backgrounds & Footers)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <g fill="#FFFFFF">
    <path d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
    <ellipse cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
    <path d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z"/>
  </g>
</svg>
```

---

## 💻 Developer Integration

### In React / TypeScript (`Logo.tsx`)
```tsx
import { Logo } from '@/components/Logo';

// Default circular teal badge
<Logo size={44} showBg={true} />

// Transparent icon with custom brand color
<Logo size={32} showBg={false} iconColor="#0F645D" />
```

### In Plain HTML
```html
<!-- Direct Image Tag -->
<img src="/logo.svg" alt="InvoCentric Logo" width="48" height="48" />

<!-- Favicon link in <head> -->
<link rel="icon" type="image/svg+xml" href="/logo.svg" />
```

---

## 📋 Asset File Locations

- **Public Vector:** `/public/logo.svg`
- **Maskable Vector:** `/public/logo-maskable.svg`
- **Raster Favicon:** `/public/favicon-48x48.png`, `/public/favicon.ico`
- **App Icons (PNG):** `/public/192x192.png`, `/public/512x512.png`
- **React Component:** `/src/components/Logo.tsx`
