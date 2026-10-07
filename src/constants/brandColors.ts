/**
 * INVOCENTRIC OFFICIAL BRAND COLOR SYSTEM
 * 
 * STRICT RULE:
 * 1. NO PURPLE (purple-*) or BLUE (blue-*) colors anywhere in the project.
 * 2. Only colors from this official brand family must be used for all UI/UX components.
 */

export const BRAND_COLORS = {
  // Primary Brand Identity: Forest Green & Emerald
  primary: {
    forest: '#166534',       // Core Brand Green (Buttons, Active Tabs, Highlights)
    deep: '#0d5c4b',         // Logo & Print Thermal Receipt Brand Green
    medium: '#059669',       // Hover states, active controls, icons
    mint: '#10b981',         // Status LED, online badges, checkmarks
    tint: '#f0fdf4',         // Soft container background, active card tint
    border: '#bbf7d0',       // Subtle green border
  },

  // Secondary Brand Accent: Warm Amber & Gold (Official Accent for PRO / SaaS Badges / Special Alerts)
  accent: {
    main: '#f59e0b',         // Badges, highlights, attention stars
    dark: '#92400e',         // Badge text, contrast warnings
    light: '#fef3c7',        // Badge backgrounds, subtle chips
    tint: '#fffbeb',         // Alert card background
    border: '#fde68a',       // Accent border
  },

  // Danger & Critical Actions: Crimson Rose (Only for Delete / Overdue / Errors)
  danger: {
    main: '#e11d48',         // Delete buttons, overdue balances, errors
    tint: '#fff1f2',         // Error card background
    border: '#fecdd3',       // Error border
  },

  // Neutrals & Surfaces: Charcoal Slate (Replaces Blue for Info / Tables / Filters)
  neutral: {
    dark: '#0f172a',         // Primary headings, dark buttons, text
    body: '#334155',         // Standard body copy
    muted: '#64748b',        // Secondary labels, subtitles
    subtle: '#94a3b8',       // Placeholders, disabled icons
    border: '#e2e8f0',       // Card borders, divider lines
    surface: '#f8fafc',      // App background canvas
    white: '#ffffff',        // Card surfaces
  }
} as const;

export default BRAND_COLORS;
