/**
 * Target Viewports Definition for InvoCentic Responsive UI Test Suite
 * Evaluated across 8 canonical screen sizes:
 * 1. 320px  (iPhone SE 1st gen)
 * 2. 360px  (Standard Android / Galaxy S series)
 * 3. 375px  (iPhone X / 11 / SE 2nd gen)
 * 4. 390px  (iPhone 12 / 13 / 14 / 15)
 * 5. 414px  (iPhone Plus / Pro Max)
 * 6. 768px  (iPad Portrait / Tablet)
 * 7. 1024px (iPad Pro / Small Laptop)
 * 8. 1440px (Desktop Full HD / Wide monitor)
 */

export const TARGET_VIEWPORTS = [
  {
    id: 'vp-320',
    name: 'iPhone SE (1st Gen)',
    category: 'mobile-compact',
    width: 320,
    height: 568,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    safeAreaInsets: { top: 20, bottom: 0, left: 0, right: 0 }
  },
  {
    id: 'vp-360',
    name: 'Standard Android (Galaxy S)',
    category: 'mobile-compact',
    width: 360,
    height: 800,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    safeAreaInsets: { top: 24, bottom: 0, left: 0, right: 0 }
  },
  {
    id: 'vp-375',
    name: 'iPhone X / 11 / SE 2',
    category: 'mobile-standard',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    safeAreaInsets: { top: 44, bottom: 34, left: 0, right: 0 }
  },
  {
    id: 'vp-390',
    name: 'iPhone 12 / 13 / 14 / 15',
    category: 'mobile-standard',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    safeAreaInsets: { top: 47, bottom: 34, left: 0, right: 0 }
  },
  {
    id: 'vp-414',
    name: 'iPhone Plus / Pro Max',
    category: 'mobile-large',
    width: 414,
    height: 896,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    safeAreaInsets: { top: 48, bottom: 34, left: 0, right: 0 }
  },
  {
    id: 'vp-768',
    name: 'iPad Portrait (Tablet)',
    category: 'tablet',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true,
    safeAreaInsets: { top: 24, bottom: 20, left: 0, right: 0 }
  },
  {
    id: 'vp-1024',
    name: 'iPad Pro / Laptop',
    category: 'desktop-compact',
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 }
  },
  {
    id: 'vp-1440',
    name: 'Desktop Full HD',
    category: 'desktop-wide',
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 }
  }
];

export function isMobileViewport(width) {
  return width < 768;
}

export function isSmallMobileViewport(width) {
  return width <= 360;
}

export function isTabletViewport(width) {
  return width >= 768 && width < 1024;
}

export function isDesktopViewport(width) {
  return width >= 1024;
}

export function getBreakpoint(width) {
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
}
