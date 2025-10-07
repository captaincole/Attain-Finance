#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { PlaidCustomUserConfig } from "./parsers/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.join(__dirname, "..", "sandbox");
const CONFIG_FILE = path.join(SANDBOX_DIR, "custom-user-config.json");

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalAccounts: number;
    totalTransactions: number;
    dateRange: { earliest: string; latest: string } | null;
  };
}

function validateConfig(config: PlaidCustomUserConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check accounts exist
  if (!config.override_accounts || config.override_accounts.length === 0) {
    errors.push("No accounts defined in override_accounts");
    return {
      valid: false,
      errors,
      warnings,
      stats: { totalAccounts: 0, totalTransactions: 0, dateRange: null },
    };
  }

  // Check account count (Plaid limit: max 10 accounts)
  if (config.override_accounts.length > 10) {
    errors.push(
      `Too many accounts: ${config.override_accounts.length}. Maximum is 10.`
    );
  }

  // Validate each account and collect transactions
  let totalTransactions = 0;
  const allDates: string[] = [];

  for (const [index, account] of config.override_accounts.entries()) {
    const accountNum = index + 1;

    // Validate account type
    if (!["depository", "credit", "loan", "investment", "payroll"].includes(account.type)) {
      errors.push(
        `Account ${accountNum}: Invalid type "${account.type}". Must be depository, credit, loan, investment, or payroll.`
      );
    }

    // Validate subtype exists
    if (!account.subtype) {
      errors.push(`Account ${accountNum}: Missing subtype`);
    }

    // Validate transactions
    if (!account.transactions || !Array.isArray(account.transactions)) {
      warnings.push(`Account ${accountNum}: No transactions defined`);
      continue;
    }

    totalTransactions += account.transactions.length;

    // Validate each transaction
    for (const [txIndex, tx] of account.transactions.entries()) {
      const txNum = txIndex + 1;

      // Check date_transacted
      if (!tx.date_transacted) {
        errors.push(
          `Account ${accountNum}, Transaction ${txNum}: Missing date_transacted`
        );
      } else {
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date_transacted)) {
          errors.push(
            `Account ${accountNum}, Transaction ${txNum}: Invalid date_transacted format "${tx.date_transacted}". Expected YYYY-MM-DD.`
          );
        } else {
          allDates.push(tx.date_transacted);
        }
      }

      // Check date_posted
      if (!tx.date_posted) {
        errors.push(
          `Account ${accountNum}, Transaction ${txNum}: Missing date_posted`
        );
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date_posted)) {
        errors.push(
          `Account ${accountNum}, Transaction ${txNum}: Invalid date_posted format "${tx.date_posted}". Expected YYYY-MM-DD.`
        );
      }

      // Check description
      if (!tx.description) {
        errors.push(
          `Account ${accountNum}, Transaction ${txNum}: Missing description`
        );
      }

      // Check amount
      if (typeof tx.amount !== "number") {
        errors.push(
          `Account ${accountNum}, Transaction ${txNum}: Invalid amount`
        );
      }

      // Check currency
      if (!tx.currency) {
        errors.push(
          `Account ${accountNum}, Transaction ${txNum}: Missing currency`
        );
      }
    }
  }

  // Check total transaction count (Plaid limit: 250)
  if (totalTransactions > 250) {
    errors.push(
      `Too many transactions: ${totalTransactions}. Maximum is 250.`
    );
  }

  // Calculate date range
  let dateRange: { earliest: string; latest: string } | null = null;
  if (allDates.length > 0) {
    allDates.sort();
    dateRange = {
      earliest: allDates[0],
      latest: allDates[allDates.length - 1],
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalAccounts: config.override_accounts.length,
      totalTransactions,
      dateRange,
    },
  };
}

async function main() {
  console.log("🔍 Validating Plaid Custom User Configuration\n");

  // Check if file exists
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`❌ Config file not found: ${CONFIG_FILE}`);
    console.error(
      "\nRun 'npm run sandbox:create' to generate the configuration first.\n"
    );
    process.exit(1);
  }

  // Read and parse config
  let config: PlaidCustomUserConfig;
  try {
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    config = JSON.parse(content);
  } catch (error: any) {
    console.error(`❌ Failed to parse config file: ${error.message}\n`);
    process.exit(1);
  }

  // Validate
  const result = validateConfig(config);

  // Print stats
  console.log("📊 Configuration Statistics:");
  console.log(`   Accounts: ${result.stats.totalAccounts}`);
  console.log(`   Total Transactions: ${result.stats.totalTransactions}`);
  if (result.stats.dateRange) {
    console.log(`   Date Range: ${result.stats.dateRange.earliest} to ${result.stats.dateRange.latest}`);
  }
  console.log();

  // Print warnings
  if (result.warnings.length > 0) {
    console.log("⚠️  Warnings:");
    for (const warning of result.warnings) {
      console.log(`   - ${warning}`);
    }
    console.log();
  }

  // Print errors
  if (result.errors.length > 0) {
    console.log("❌ Validation Errors:");
    for (const error of result.errors) {
      console.log(`   - ${error}`);
    }
    console.log();
    process.exit(1);
  }

  console.log("✅ Configuration is valid!\n");
  console.log("📋 Ready to upload to Plaid Dashboard:");
  console.log("   1. Go to https://dashboard.plaid.com/developers/sandbox");
  console.log("   2. Create new custom user");
  console.log("   3. Username: user_custom_bofa_chase_venmo");
  console.log(`   4. Paste JSON from: ${CONFIG_FILE}\n`);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
