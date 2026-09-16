/**
 * Source Code & DOM Layout Static Verification Analyzer
 * Analyzes application files, CSS definitions, JSX class constructs,
 * and responsive attributes against project specifications.
 */

import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = process.cwd();

/**
 * Reads a workspace source file safely
 */
export function readSourceFile(relativePath) {
  const fullPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(WORKSPACE_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Checks if HTML meta viewport contains required responsive tokens
 */
export function checkViewportMetaTokens(indexHtmlContent) {
  const metaMatch = indexHtmlContent.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i);
  if (!metaMatch) return { valid: false, error: 'No viewport meta tag found' };
  
  const content = metaMatch[1];
  const hasWidth = content.includes('width=device-width');
  const hasScale = content.includes('initial-scale=1');
  const hasViewportFit = content.includes('viewport-fit=cover');
  const hasInteractiveWidget = content.includes('interactive-widget=resizes-content');

  return {
    valid: hasWidth && hasScale,
    hasWidth,
    hasScale,
    hasViewportFit,
    hasInteractiveWidget,
    rawContent: content
  };
}

/**
 * Checks if CSS file defines safe-area utility classes
 */
export function checkSafeAreaUtilities(cssContent) {
  const utilities = {
    hasPbSafe: /\.pb-safe\s*\{/.test(cssContent) || cssContent.includes('padding-bottom: env(safe-area-inset-bottom'),
    hasPtSafe: /\.pt-safe\s*\{/.test(cssContent) || cssContent.includes('padding-top: env(safe-area-inset-top'),
    hasPlSafe: /\.pl-safe\s*\{/.test(cssContent) || cssContent.includes('padding-left: env(safe-area-inset-left'),
    hasPrSafe: /\.pr-safe\s*\{/.test(cssContent) || cssContent.includes('padding-right: env(safe-area-inset-right'),
    hasMbSafe: /\.mb-safe\s*\{/.test(cssContent) || cssContent.includes('margin-bottom: env(safe-area-inset-bottom')
  };

  return {
    ...utilities,
    allPresent: utilities.hasPbSafe || utilities.hasPtSafe
  };
}

/**
 * Checks if global border-radius override respects directional rounded corners
 */
export function checkBorderRadiusOverride(cssContent) {
  const match = cssContent.match(/\[class\*="rounded-3xl"\][\s\S]*?\{[\s\S]*?border-radius:\s*12px/);
  if (!match) return { hasOverride: false, safe: true };

  const snippet = match[0];
  const hasDirectionalExclusion = snippet.includes(':not([class*="rounded-t-"]') ||
                                 snippet.includes(':not([class*="rounded-b-"]') ||
                                 !snippet.includes('!important');

  return {
    hasOverride: true,
    safe: hasDirectionalExclusion,
    snippet
  };
}

/**
 * Scans component source code for dangerous fixed min-widths
 */
export function findFixedMinWidthViolations(code, maxAllowed = 320) {
  const fixedMinMatches = [...code.matchAll(/min-w-\[(\d+)px\]/g)];
  const violations = [];

  for (const match of fixedMinMatches) {
    const pixels = parseInt(match[1], 10);
    if (pixels > maxAllowed) {
      violations.push({
        rawMatch: match[0],
        pixels,
        index: match.index
      });
    }
  }

  return violations;
}

/**
 * Inspects a component's modal / bottom-sheet styling patterns
 */
export function inspectModalErgonomics(code) {
  const hasFixedInset = code.includes('fixed inset-0');
  const hasItemsEndOnMobile = code.includes('items-end sm:items-center') || code.includes('items-end');
  const hasMaxHeight = code.includes('max-h-[9') || code.includes('max-h-[85vh]') || code.includes('max-h-[90vh]');
  const hasOverflowY = code.includes('overflow-y-auto') || code.includes('overflow-auto');
  const hasRoundedTop = code.includes('rounded-t-3xl') || code.includes('rounded-t-2xl') || code.includes('rounded-t-[');
  const hasDragHandle = code.includes('w-12 h-1.5') || code.includes('w-10 h-1') || code.includes('rounded-full bg-');
  const hasAbsoluteCenterBug = code.includes('top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2');

  return {
    hasFixedInset,
    hasItemsEndOnMobile,
    hasMaxHeight,
    hasOverflowY,
    hasRoundedTop,
    hasDragHandle,
    hasAbsoluteCenterBug,
    isResponsiveSheet: hasFixedInset && (hasMaxHeight || hasOverflowY)
  };
}

/**
 * Inspects tabular pages for mobile card reflow patterns (dual view)
 */
export function inspectTableCardReflow(code) {
  const hasDesktopTable = code.includes('hidden md:block') || (code.includes('<table') && code.includes('md:'));
  const hasMobileCards = code.includes('block md:hidden') || (code.includes('md:hidden') && code.includes('space-y-'));
  const hasTouchScrollContainer = code.includes('overflow-x-auto') || code.includes('overflow-x-scroll');

  return {
    hasDesktopTable,
    hasMobileCards,
    hasTouchScrollContainer,
    hasDualView: hasDesktopTable && hasMobileCards
  };
}
