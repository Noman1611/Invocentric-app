/**
 * Master E2E & Responsive Test Suite Runner for InvoCentic
 * Evaluates Tiers 1-4 across 8 Target Viewports:
 * 1. 320px  (iPhone SE 1st gen)
 * 2. 360px  (Standard Android)
 * 3. 375px  (iPhone X / 11 / SE 2nd gen)
 * 4. 390px  (iPhone 12 / 13 / 14 / 15)
 * 5. 414px  (iPhone Plus / Pro Max)
 * 6. 768px  (iPad Portrait)
 * 7. 1024px (iPad Pro / Laptop)
 * 8. 1440px (Desktop Full HD)
 */

import { runner } from './helpers/test-framework.mjs';
import { registerTier1Tests } from './tier1-features.test.mjs';
import { registerTier2Tests } from './tier2-boundary.test.mjs';
import { registerTier3Tests } from './tier3-combinations.test.mjs';
import { registerTier4Tests } from './tier4-scenarios.test.mjs';

async function main() {
  console.log('\n[E2E Runner] Initializing InvoCentic Responsive & Logic Test Suite...');
  
  // Register all 4 Tiers
  registerTier1Tests();
  registerTier2Tests();
  registerTier3Tests();
  registerTier4Tests();

  // Run the full test suite
  const results = await runner.runAll();

  if (results.failed > 0) {
    console.error(`\n❌ Test Run Failed with ${results.failed} failing tests.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All ${results.total} tests passed across all 8 target viewports!\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
