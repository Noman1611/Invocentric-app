import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const distFiles = fs.readdirSync('dist/assets');
  const cssFileName = distFiles.find(f => f.endsWith('.css'));
  if (!cssFileName) {
    throw new Error('No CSS file found in dist/assets');
  }
  const cssContent = fs.readFileSync(path.join('dist/assets', cssFileName), 'utf8');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Load CSS into page
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>${cssContent}</style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>
  `);

  const testCases = [
    // Primary classes required by prompt
    { name: 'rounded-t-3xl', classes: 'rounded-t-3xl', expected: { top: true, bottom: '0px' } },
    { name: 'rounded-b-2xl', classes: 'rounded-b-2xl', expected: { top: '0px', bottom: true } },
    { name: 'rounded-l-lg', classes: 'rounded-l-lg', expected: { left: true, right: '0px' } },
    { name: 'rounded-r-xl', classes: 'rounded-r-xl', expected: { left: '0px', right: true } },
    { name: 'rounded-full', classes: 'rounded-full', expected: { isFull: true } },
    { name: 'rounded-2xl', classes: 'rounded-2xl', expected: { uniform: '12px' } },

    // Additional non-directional corner classes
    { name: 'rounded-lg', classes: 'rounded-lg', expected: { uniform: '12px' } },
    { name: 'rounded-xl', classes: 'rounded-xl', expected: { uniform: '12px' } },
    { name: 'rounded-3xl', classes: 'rounded-3xl', expected: { uniform: '12px' } },
    { name: 'rounded-4xl', classes: 'rounded-4xl', expected: { uniform: '12px' } },
    { name: 'rounded-[30px]', classes: 'rounded-[30px]', expected: { uniform: '12px' } },

    // Additional directional corner classes
    { name: 'rounded-t-lg', classes: 'rounded-t-lg', expected: { top: true, bottom: '0px' } },
    { name: 'rounded-t-xl', classes: 'rounded-t-xl', expected: { top: true, bottom: '0px' } },
    { name: 'rounded-t-2xl', classes: 'rounded-t-2xl', expected: { top: true, bottom: '0px' } },
    { name: 'rounded-t-4xl', classes: 'rounded-t-4xl', expected: { top: true, bottom: '0px' } },
    { name: 'rounded-b-lg', classes: 'rounded-b-lg', expected: { top: '0px', bottom: true } },
    { name: 'rounded-b-xl', classes: 'rounded-b-xl', expected: { top: '0px', bottom: true } },
    { name: 'rounded-b-3xl', classes: 'rounded-b-3xl', expected: { top: '0px', bottom: true } },
    { name: 'rounded-b-4xl', classes: 'rounded-b-4xl', expected: { top: '0px', bottom: true } },
    { name: 'rounded-l-xl', classes: 'rounded-l-xl', expected: { left: true, right: '0px' } },
    { name: 'rounded-l-2xl', classes: 'rounded-l-2xl', expected: { left: true, right: '0px' } },
    { name: 'rounded-r-lg', classes: 'rounded-r-lg', expected: { left: '0px', right: true } },
    { name: 'rounded-r-2xl', classes: 'rounded-r-2xl', expected: { left: '0px', right: true } },

    // Pill / Circle exclusions
    { name: 'rounded-[50%]', classes: 'rounded-[50%]', expected: { is50Pct: true } },
    { name: 'rounded-[9999px]', classes: 'rounded-[9999px]', expected: { isFull: true } },

    // Real Component combinations
    { name: 'QuickPOS modal pattern: rounded-t-3xl shadow-2xl bg-white', classes: 'rounded-t-3xl shadow-2xl bg-white', expected: { top: true, bottom: '0px' } },
    { name: 'UpdateCatalogEntryModal pattern: rounded-t-3xl sm:rounded-3xl', classes: 'rounded-t-3xl sm:rounded-3xl', expected: { top: true, bottom: '0px' } },
    { name: 'Avatar pill pattern: rounded-full bg-slate-100', classes: 'rounded-full bg-slate-100', expected: { isFull: true } },
    { name: 'Card standard pattern: bg-white p-4 rounded-2xl shadow-sm', classes: 'bg-white p-4 rounded-2xl shadow-sm', expected: { uniform: '12px' } }
  ];

  console.log('Running Empirical Playwright Corner Radius Verification...\n');
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const radii = await page.evaluate((cls) => {
      const div = document.createElement('div');
      div.className = cls;
      div.style.width = '100px';
      div.style.height = '100px';
      document.getElementById('test-container').appendChild(div);
      const computed = window.getComputedStyle(div);
      const res = {
        tl: computed.borderTopLeftRadius,
        tr: computed.borderTopRightRadius,
        bl: computed.borderBottomLeftRadius,
        br: computed.borderBottomRightRadius,
        raw: computed.borderRadius
      };
      div.remove();
      return res;
    }, tc.classes);

    let ok = true;
    let details = '';

    if (tc.expected.uniform) {
      if (radii.tl !== tc.expected.uniform || radii.tr !== tc.expected.uniform || radii.bl !== tc.expected.uniform || radii.br !== tc.expected.uniform) {
        ok = false;
        details = `Expected uniform ${tc.expected.uniform}, got TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      } else {
        details = `Uniform 12px: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      }
    } else if (tc.expected.isFull) {
      if (radii.tl === '12px' || radii.tr === '12px' || radii.bl === '12px' || radii.br === '12px') {
        ok = false;
        details = `Expected full pill/circle, but got 12px override: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      } else {
        details = `Pill/Circle preserved: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      }
    } else if (tc.expected.is50Pct) {
      if (radii.tl === '12px' || radii.tr === '12px' || radii.bl === '12px' || radii.br === '12px') {
        ok = false;
        details = `Expected 50% circle, but got 12px override: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      } else {
        details = `50% circle preserved: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      }
    } else if (tc.expected.top && tc.expected.bottom === '0px') {
      if (radii.bl !== '0px' || radii.br !== '0px' || radii.tl === '0px' || radii.tr === '0px') {
        ok = false;
        details = `Expected top rounded & bottom 0px, got TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      } else {
        details = `Top preserved, Bottom 0px: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      }
    } else if (tc.expected.bottom && tc.expected.top === '0px') {
      if (radii.tl !== '0px' || radii.tr !== '0px' || radii.bl === '0px' || radii.br === '0px') {
        ok = false;
        details = `Expected bottom rounded & top 0px, got TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      } else {
        details = `Bottom preserved, Top 0px: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      }
    } else if (tc.expected.left && tc.expected.right === '0px') {
      if (radii.tr !== '0px' || radii.br !== '0px' || radii.tl === '0px' || radii.bl === '0px') {
        ok = false;
        details = `Expected left rounded & right 0px, got TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      } else {
        details = `Left preserved, Right 0px: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      }
    } else if (tc.expected.right && tc.expected.left === '0px') {
      if (radii.tl !== '0px' || radii.bl !== '0px' || radii.tr === '0px' || radii.br === '0px') {
        ok = false;
        details = `Expected right rounded & left 0px, got TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      } else {
        details = `Right preserved, Left 0px: TL=${radii.tl}, TR=${radii.tr}, BL=${radii.bl}, BR=${radii.br}`;
      }
    }

    if (ok) {
      console.log(`  ✓ ${tc.name}: ${details}`);
      passed++;
    } else {
      console.log(`  ✗ ${tc.name}: ${details}`);
      failed++;
    }
  }

  console.log(`\n======================================================================`);
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${testCases.length} tests.`);
  console.log(`======================================================================\n`);

  await browser.close();
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
