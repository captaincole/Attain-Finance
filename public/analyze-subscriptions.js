#!/usr/bin/env node

/**
 * Subscription Detection Script
 *
 * Analyzes credit card transactions to identify recurring subscriptions.
 * Run: node analyze-subscriptions.js [path-to-csv]
 *
 * Detection Logic:
 * - Groups transactions by merchant name
 * - Identifies merchants with identical amounts appearing 2+ times
 * - Validates monthly recurring pattern (25-35 day intervals)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      date: new Date(values[0]),
      description: values[1],
      amount: parseFloat(values[2]),
      category: values[3]
    };
  });
}

// Group transactions by merchant
function groupByMerchant(transactions) {
  const groups = {};

  transactions.forEach(tx => {
    const merchant = tx.description;
    if (!groups[merchant]) {
      groups[merchant] = [];
    }
    groups[merchant].push(tx);
  });

  return groups;
}

// Check if transactions form a monthly recurring pattern
function isMonthlyRecurring(transactions) {
  if (transactions.length < 2) return false;

  // Sort by date
  const sorted = [...transactions].sort((a, b) => a.date - b.date);

  // Check if all amounts are identical
  const firstAmount = sorted[0].amount;
  const sameAmount = sorted.every(tx => Math.abs(tx.amount - firstAmount) < 0.01);

  if (!sameAmount) return false;

  // Check intervals between transactions (should be roughly monthly: 25-35 days)
  for (let i = 1; i < sorted.length; i++) {
    const daysDiff = (sorted[i].date - sorted[i-1].date) / (1000 * 60 * 60 * 24);
    if (daysDiff < 25 || daysDiff > 35) {
      return false;
    }
  }

  return true;
}

// Analyze subscriptions
function detectSubscriptions(transactions) {
  const grouped = groupByMerchant(transactions);
  const subscriptions = [];

  Object.entries(grouped).forEach(([merchant, txs]) => {
    if (isMonthlyRecurring(txs)) {
      const sorted = [...txs].sort((a, b) => a.date - b.date);
      const amount = sorted[0].amount;
      const count = sorted.length;
      const totalSpent = amount * count;
      const annualProjection = amount * 12;

      // Calculate average day of month
      const daysOfMonth = sorted.map(tx => tx.date.getDate());
      const avgDay = Math.round(daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length);

      subscriptions.push({
        merchant,
        monthlyAmount: amount,
        occurrences: count,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        annualProjection: parseFloat(annualProjection.toFixed(2)),
        pattern: `Monthly on the ${avgDay}${getDaySuffix(avgDay)}`,
        category: sorted[0].category,
        firstSeen: sorted[0].date.toISOString().split('T')[0],
        lastSeen: sorted[sorted.length - 1].date.toISOString().split('T')[0]
      });
    }
  });

  return subscriptions.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

function getDaySuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Main execution
function main() {
  const csvPath = process.argv[2] || path.join(__dirname, 'transactions.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: File not found at ${csvPath}`);
    console.error('Usage: node analyze-subscriptions.js [path-to-csv]');
    process.exit(1);
  }

  console.log(`Analyzing transactions from: ${csvPath}\n`);

  const transactions = parseCSV(csvPath);
  const subscriptions = detectSubscriptions(transactions);

  // Summary
  const totalMonthly = subscriptions.reduce((sum, sub) => sum + sub.monthlyAmount, 0);
  const totalAnnual = subscriptions.reduce((sum, sub) => sum + sub.annualProjection, 0);

  console.log('=== SUBSCRIPTION ANALYSIS RESULTS ===\n');
  console.log(`Total Monthly Subscription Cost: $${totalMonthly.toFixed(2)}`);
  console.log(`Total Annual Projection: $${totalAnnual.toFixed(2)}`);
  console.log(`Number of Subscriptions Found: ${subscriptions.length}\n`);

  if (subscriptions.length === 0) {
    console.log('No recurring subscriptions detected.');
    return;
  }

  console.log('=== DETECTED SUBSCRIPTIONS ===\n');

  subscriptions.forEach((sub, index) => {
    console.log(`${index + 1}. ${sub.merchant}`);
    console.log(`   Monthly Cost: $${sub.monthlyAmount.toFixed(2)}`);
    console.log(`   Occurrences: ${sub.occurrences} times`);
    console.log(`   Pattern: ${sub.pattern}`);
    console.log(`   Total Spent: $${sub.totalSpent.toFixed(2)}`);
    console.log(`   Annual Projection: $${sub.annualProjection.toFixed(2)}`);
    console.log(`   Category: ${sub.category}`);
    console.log(`   Period: ${sub.firstSeen} to ${sub.lastSeen}`);
    console.log('');
  });

  // JSON output option
  if (process.argv.includes('--json')) {
    console.log('\n=== JSON OUTPUT ===');
    console.log(JSON.stringify({
      summary: {
        totalMonthly,
        totalAnnual,
        count: subscriptions.length
      },
      subscriptions
    }, null, 2));
  }
}

// Run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseCSV, detectSubscriptions };
