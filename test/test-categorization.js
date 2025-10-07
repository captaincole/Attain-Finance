#!/usr/bin/env node
/**
 * Test script to verify Claude API categorization
 * Reads sample transactions CSV and categorizes them using the Claude API
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { categorizeTransactions } from '../build/utils/claude-client.js';

// Load environment variables
dotenv.config();

const CSV_FILE = process.argv[2] || 'test/sample_data/sample_transactions_uncategorized.csv';

async function main() {
  console.log('=== Transaction Categorization Test ===\n');
  console.log(`Reading CSV: ${CSV_FILE}`);

  // Read CSV file
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Found ${records.length} transactions\n`);

  // Prepare transactions for categorization
  const transactions = records.map((row) => ({
    date: row.date,
    description: row.description,
    amount: row.amount,
    category: row.category || undefined,
    account_name: row.account_name || undefined,
    pending: row.pending,
  }));

  console.log('Sample transaction (first):');
  console.log(JSON.stringify(transactions[0], null, 2));
  console.log('\nCalling Claude API...\n');

  const startTime = Date.now();

  try {
    const categorized = await categorizeTransactions(transactions);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✓ Categorization complete in ${elapsedTime}s\n`);
    console.log(`Input: ${transactions.length} transactions`);
    console.log(`Output: ${categorized.length} categorized transactions`);
    console.log(`Match: ${transactions.length === categorized.length ? '✓ YES' : '✗ NO - MISMATCH!'}\n`);

    if (transactions.length !== categorized.length) {
      console.error('ERROR: Transaction count mismatch!');
      console.error(`Missing: ${transactions.length - categorized.length} transactions`);
      process.exit(1);
    }

    // Sample output
    console.log('Sample categorized transactions:');
    categorized.slice(0, 5).forEach((tx, i) => {
      console.log(`${i + 1}. ${tx.description} → ${tx.custom_category}`);
    });

    console.log('\nCategory distribution:');
    const categoryCount = {};
    categorized.forEach((tx) => {
      categoryCount[tx.custom_category] = (categoryCount[tx.custom_category] || 0) + 1;
    });

    Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} transactions`);
      });

    // Write output file
    const outputFile = CSV_FILE.replace('.csv', '_categorized.csv');
    const csvLines = [
      'date,description,amount,category,custom_category,account_name,pending',
      ...categorized.map((tx) =>
        [
          tx.date,
          `"${tx.description.replace(/"/g, '""')}"`,
          tx.amount,
          '""', // Original category (empty)
          `"${tx.custom_category}"`,
          '""', // Account name (not in categorization response)
          'false',
        ].join(',')
      ),
    ].join('\n');

    fs.writeFileSync(outputFile, csvLines);
    console.log(`\n✓ Wrote categorized transactions to: ${outputFile}`);

    console.log('\n=== TEST PASSED ===');
  } catch (error) {
    console.error('\n✗ Categorization failed:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

main();
