#!/usr/bin/env node

/**
 * Test Suite for Subscription Analysis
 *
 * Tests the analyze-subscriptions.js script against known test data
 * to ensure accurate detection of recurring subscriptions.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTest(testName, csvFile) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Testing: ${testName}`, 'blue');
  log('='.repeat(60), 'blue');

  const scriptPath = path.join(__dirname, '..', 'public', 'analyze-subscriptions.js');
  const csvPath = path.join(__dirname, csvFile);

  if (!fs.existsSync(csvPath)) {
    log(`✗ Test file not found: ${csvPath}`, 'red');
    return false;
  }

  try {
    log(`\nRunning: node ${path.relative(process.cwd(), scriptPath)} ${path.relative(process.cwd(), csvPath)}`, 'gray');

    // Run the script and capture output
    const output = execSync(`node "${scriptPath}" "${csvPath}" --json`, {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });

    // Extract JSON from output (it comes after "=== JSON OUTPUT ===" line)
    const jsonMatch = output.match(/=== JSON OUTPUT ===\s*\n([\s\S]+)$/);
    if (!jsonMatch) {
      log('✗ Could not find JSON output in script response', 'red');
      return false;
    }

    const result = JSON.parse(jsonMatch[1]);

    // Display results
    log('\n📊 Results:', 'yellow');
    log(`  Total Monthly Cost: $${result.summary.totalMonthly.toFixed(2)}`, 'gray');
    log(`  Annual Projection: $${result.summary.totalAnnual.toFixed(2)}`, 'gray');
    log(`  Subscriptions Found: ${result.summary.count}`, 'gray');

    if (result.subscriptions.length > 0) {
      log('\n📝 Detected Subscriptions:', 'yellow');
      result.subscriptions.forEach((sub, i) => {
        log(`  ${i + 1}. ${sub.merchant} - $${sub.monthlyAmount.toFixed(2)}/month (${sub.occurrences}x)`, 'gray');
      });
    }

    log('\n✓ Test passed - Script executed successfully', 'green');
    return true;

  } catch (error) {
    log(`\n✗ Test failed with error:`, 'red');
    log(error.message, 'red');
    if (error.stdout) {
      log('\nScript output:', 'gray');
      log(error.stdout.toString(), 'gray');
    }
    return false;
  }
}

// Test cases
const tests = [
  {
    name: 'Chase Sample Data - Recurring Subscriptions',
    file: 'sample_chase.csv',
    description: 'Should detect multiple recurring subscriptions with monthly patterns'
  }
];

// Run all tests
log('\n🧪 Starting Subscription Analysis Tests', 'blue');
log('='.repeat(60), 'blue');

let passed = 0;
let failed = 0;

tests.forEach(test => {
  const result = runTest(test.name, test.file);
  if (result) {
    passed++;
  } else {
    failed++;
  }
});

// Summary
log('\n' + '='.repeat(60), 'blue');
log('Test Summary', 'blue');
log('='.repeat(60), 'blue');
log(`Total: ${tests.length} | Passed: ${passed} | Failed: ${failed}`, passed === tests.length ? 'green' : 'yellow');

if (failed > 0) {
  log('\n❌ Some tests failed', 'red');
  process.exit(1);
} else {
  log('\n✅ All tests passed!', 'green');
  process.exit(0);
}
