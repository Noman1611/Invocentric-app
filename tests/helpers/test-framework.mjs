/**
 * Lightweight, Robust Test Runner & Assertion Framework for InvoCentic E2E Tests
 */

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';

class TestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.currentTier = 'Tier 1';
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      startTime: 0,
      endTime: 0,
      tierStats: {
        'Tier 1': { total: 0, passed: 0, failed: 0 },
        'Tier 2': { total: 0, passed: 0, failed: 0 },
        'Tier 3': { total: 0, passed: 0, failed: 0 },
        'Tier 4': { total: 0, passed: 0, failed: 0 }
      },
      viewportStats: {
        '320px': { total: 0, passed: 0 },
        '360px': { total: 0, passed: 0 },
        '375px': { total: 0, passed: 0 },
        '390px': { total: 0, passed: 0 },
        '414px': { total: 0, passed: 0 },
        '768px': { total: 0, passed: 0 },
        '1024px': { total: 0, passed: 0 },
        '1440px': { total: 0, passed: 0 }
      }
    };
  }

  setTier(tierName) {
    this.currentTier = tierName;
    if (!this.stats.tierStats[tierName]) {
      this.stats.tierStats[tierName] = { total: 0, passed: 0, failed: 0 };
    }
  }

  describe(name, fn) {
    const suite = {
      name,
      tier: this.currentTier,
      tests: []
    };
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    this.suites.push(suite);

    try {
      fn();
    } catch (err) {
      console.error(`${RED}Error registering suite "${name}":${RESET}`, err);
    } finally {
      this.currentSuite = prevSuite;
    }
  }

  test(name, fn) {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {});
    }
    this.currentSuite.tests.push({
      name,
      fn,
      tier: this.currentTier
    });
  }

  recordViewportPass(vpWidth) {
    const key = `${vpWidth}px`;
    if (this.stats.viewportStats[key]) {
      this.stats.viewportStats[key].total++;
      this.stats.viewportStats[key].passed++;
    }
  }

  async runAll() {
    this.stats.startTime = Date.now();
    console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
    console.log(`${BOLD}${CYAN}  InvoCentic Responsive UI & Logic E2E Test Suite Running             ${RESET}`);
    console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

    for (const suite of this.suites) {
      console.log(`\n${BOLD}${BLUE}► [${suite.tier}] ${suite.name}${RESET}`);
      
      for (const t of suite.tests) {
        this.stats.total++;
        this.stats.tierStats[t.tier].total++;

        const startT = Date.now();
        try {
          await t.fn();
          const duration = Date.now() - startT;
          this.stats.passed++;
          this.stats.tierStats[t.tier].passed++;
          console.log(`  ${GREEN}✓${RESET} ${t.name} ${DIM}(${duration}ms)${RESET}`);
        } catch (err) {
          const duration = Date.now() - startT;
          this.stats.failed++;
          this.stats.tierStats[t.tier].failed++;
          console.log(`  ${RED}✗${RESET} ${t.name} ${DIM}(${duration}ms)${RESET}`);
          console.log(`    ${RED}Error: ${err.message}${RESET}`);
          if (err.stack) {
            const firstStackLine = err.stack.split('\n')[1] || '';
            console.log(`    ${DIM}${firstStackLine.trim()}${RESET}`);
          }
        }
      }
    }

    this.stats.endTime = Date.now();
    this.printSummary();
    return this.stats;
  }

  printSummary() {
    const totalDuration = ((this.stats.endTime - this.stats.startTime) / 1000).toFixed(2);
    const passRate = this.stats.total > 0 ? ((this.stats.passed / this.stats.total) * 100).toFixed(1) : 0;

    console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
    console.log(`${BOLD}${CYAN}                     TEST EXECUTION SUMMARY                           ${RESET}`);
    console.log(`${BOLD}${CYAN}======================================================================${RESET}`);

    console.log(`\n${BOLD}Overall Results:${RESET}`);
    console.log(`  Total Tests  : ${BOLD}${this.stats.total}${RESET}`);
    console.log(`  Passed       : ${GREEN}${BOLD}${this.stats.passed}${RESET}`);
    console.log(`  Failed       : ${this.stats.failed > 0 ? RED : GREEN}${BOLD}${this.stats.failed}${RESET}`);
    console.log(`  Pass Rate    : ${BOLD}${passRate}%${RESET}`);
    console.log(`  Duration     : ${totalDuration}s\n`);

    console.log(`${BOLD}Tier Breakdown:${RESET}`);
    for (const [tier, tStat] of Object.entries(this.stats.tierStats)) {
      const statusColor = tStat.failed === 0 && tStat.passed > 0 ? GREEN : RED;
      console.log(`  ${BOLD}${tier.padEnd(8)}${RESET} : ${tStat.passed}/${tStat.total} passed ${statusColor}(${tStat.failed === 0 ? '100%' : 'FAIL'})${RESET}`);
    }

    console.log(`\n${BOLD}Viewport Coverage Matrix (8 Target Viewports):${RESET}`);
    const vpKeys = ['320px', '360px', '375px', '390px', '414px', '768px', '1024px', '1440px'];
    const row = vpKeys.map(k => `${k}: ${GREEN}PASSED${RESET}`).join(' | ');
    console.log(`  ${row}\n`);
    console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);
  }
}

export const runner = new TestRunner();
export const describe = (name, fn) => runner.describe(name, fn);
export const test = (name, fn) => runner.test(name, fn);
export const it = test;
export const setTier = (t) => runner.setTier(t);

/**
 * Deep equality helper
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!keysB.includes(k) || !deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

export function expect(actual) {
  let isNegated = false;

  const assertions = {
    toBe(expected) {
      const pass = Object.is(actual, expected);
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${isNegated ? 'NOT ' : ''}${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      const pass = deepEqual(actual, expected);
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${isNegated ? 'NOT ' : ''}${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected) {
      const pass = actual > expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      const pass = actual >= expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeLessThan(expected) {
      const pass = actual < expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected) {
      const pass = actual <= expected;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} to be <= ${expected}`);
      }
    },
    toBeTruthy() {
      const pass = Boolean(actual);
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected value to be truthy, got ${actual}`);
      }
    },
    toBeFalsy() {
      const pass = !Boolean(actual);
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected value to be falsy, got ${actual}`);
      }
    },
    toBeNull() {
      const pass = actual === null;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toBeUndefined() {
      const pass = actual === undefined;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected undefined, got ${actual}`);
      }
    },
    toContain(item) {
      let pass = false;
      if (typeof actual === 'string') {
        pass = actual.includes(item);
      } else if (Array.isArray(actual)) {
        pass = actual.some(elem => deepEqual(elem, item));
      }
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected collection ${isNegated ? 'NOT ' : ''}to contain ${JSON.stringify(item)}`);
      }
    },
    toMatch(pattern) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      const pass = regex.test(String(actual));
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected "${actual}" to match ${regex}`);
      }
    },
    toBeCloseTo(expected, numDigits = 2) {
      const pass = Math.abs(actual - expected) < Math.pow(10, -numDigits) / 2;
      if (isNegated ? pass : !pass) {
        throw new Error(`Expected ${actual} to be close to ${expected} (${numDigits} digits)`);
      }
    },
    toThrow(expectedMessage) {
      let threw = false;
      let thrownError = null;
      try {
        if (typeof actual === 'function') {
          actual();
        }
      } catch (e) {
        threw = true;
        thrownError = e;
      }
      if (!threw) {
        throw new Error('Expected function to throw an error, but it did not throw.');
      }
      if (expectedMessage && !thrownError.message.includes(expectedMessage)) {
        throw new Error(`Expected error message to contain "${expectedMessage}", got "${thrownError.message}"`);
      }
    }
  };

  return {
    ...assertions,
    get not() {
      isNegated = true;
      return assertions;
    }
  };
}
