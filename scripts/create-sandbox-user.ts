#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BofAParser } from "./parsers/bofa-parser.js";
import { ChaseParser } from "./parsers/chase-parser.js";
import { VenmoParser } from "./parsers/venmo-parser.js";
import type {
  StandardTransaction,
  PlaidTransaction,
  PlaidAccount,
  PlaidCustomUserConfig,
} from "./parsers/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.join(__dirname, "..", "sandbox");
const DATA_DIR = path.join(SANDBOX_DIR, "data");
const OUTPUT_FILE = path.join(SANDBOX_DIR, "custom-user-config.json");

/**
 * Convert StandardTransaction to PlaidTransaction
 * Plaid convention: positive = outflow, negative = inflow
 * Our convention: negative = outflow, positive = inflow
 */
function toPlaidTransaction(tx: StandardTransaction): PlaidTransaction {
  return {
    date_transacted: tx.date,
    date_posted: tx.date, // Use same date for both
    description: tx.description,
    amount: -tx.amount, // Flip sign for Plaid convention
    currency: "USD",
  };
}

/**
 * Calculate starting balance from transactions
 * For checking account: start balance - all net transactions = ending balance
 */
function calculateStartingBalance(
  endingBalance: number,
  transactions: StandardTransaction[]
): number {
  const netChange = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  return endingBalance - netChange;
}

async function main() {
  console.log("🏦 Generating Plaid Custom Sandbox User Configuration\n");

  // Parse Bank of America checking
  console.log("📄 Parsing Bank of America checking...");
  const bofaParser = new BofAParser();
  const bofaPath = path.join(DATA_DIR, "bankofamerica.csv");
  const bofaTransactions = await bofaParser.parse(bofaPath);
  console.log(`   ✓ Found ${bofaTransactions.length} transactions\n`);

  // Parse Chase credit card (limit to 150)
  console.log("📄 Parsing Chase credit card...");
  const chaseParser = new ChaseParser(150);
  const chasePath = path.join(DATA_DIR, "chasedata.CSV");
  const chaseTransactions = await chaseParser.parse(chasePath);
  console.log(`   ✓ Kept ${chaseTransactions.length} transactions\n`);

  // Parse Venmo (all 3 monthly files)
  console.log("📄 Parsing Venmo statements...");
  const venmoParser = new VenmoParser();
  const venmoPaths = [
    path.join(DATA_DIR, "VenmoStatement_August_2025.csv"),
    path.join(DATA_DIR, "VenmoStatement_September_2025.csv"),
    path.join(DATA_DIR, "VenmoStatement_October_2025.csv"),
  ];
  const venmoTransactions = await venmoParser.parse(venmoPaths);
  console.log(`   ✓ Found ${venmoTransactions.length} transactions\n`);

  // Total transaction count
  const totalTransactions =
    bofaTransactions.length +
    chaseTransactions.length +
    venmoTransactions.length;

  console.log(`📊 Total transactions: ${totalTransactions}`);

  if (totalTransactions > 250) {
    console.error(
      `\n⚠️  WARNING: Total transactions (${totalTransactions}) exceeds Plaid limit of 250!`
    );
    console.error(
      "   Reduce the number of transactions in one of the CSV files or adjust the Chase limit.\n"
    );
    process.exit(1);
  }

  // Build Plaid configuration
  console.log("\n🔧 Building Plaid configuration...\n");

  // Bank of America checking account
  // Ending balance from CSV: $32,278.60
  const bofaEndingBalance = 32278.6;
  const bofaStartingBalance = calculateStartingBalance(
    bofaEndingBalance,
    bofaTransactions
  );

  const bofaAccount: PlaidAccount = {
    type: "depository",
    subtype: "checking",
    starting_balance: bofaStartingBalance,
    transactions: bofaTransactions.map(toPlaidTransaction),
  };

  console.log(`   ✓ Bank of America Checking`);
  console.log(`     Starting balance: $${bofaStartingBalance.toFixed(2)}`);
  console.log(`     Ending balance: $${bofaEndingBalance.toFixed(2)}`);
  console.log(`     Transactions: ${bofaTransactions.length}\n`);

  // Chase credit card
  // Credit cards typically start at 0 balance in Plaid sandbox
  const chaseAccount: PlaidAccount = {
    type: "credit",
    subtype: "credit card",
    starting_balance: 0,
    transactions: chaseTransactions.map(toPlaidTransaction),
  };

  console.log(`   ✓ Chase Credit Card`);
  console.log(`     Starting balance: $0.00`);
  console.log(`     Transactions: ${chaseTransactions.length}\n`);

  // Venmo account (PayPal subtype is closest match)
  // Starting balance from August statement: $1,253.71
  const venmoStartingBalance = 1253.71;

  const venmoAccount: PlaidAccount = {
    type: "depository",
    subtype: "paypal",
    starting_balance: venmoStartingBalance,
    transactions: venmoTransactions.map(toPlaidTransaction),
  };

  console.log(`   ✓ Venmo`);
  console.log(`     Starting balance: $${venmoStartingBalance.toFixed(2)}`);
  console.log(`     Transactions: ${venmoTransactions.length}\n`);

  // Create final config
  const config: PlaidCustomUserConfig = {
    seed: "bofa-chase-venmo-real-data",
    override_accounts: [bofaAccount, chaseAccount, venmoAccount],
  };

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(config, null, 2));

  console.log(`✅ Configuration written to: ${OUTPUT_FILE}\n`);
  console.log("📋 Next steps:");
  console.log("   1. Go to Plaid Dashboard → Developers → Sandbox");
  console.log("   2. Create a new custom user");
  console.log("   3. Set username: user_custom_bofa_chase_venmo");
  console.log("   4. Copy and paste the JSON from the config file");
  console.log("   5. Use in Plaid Link with any password\n");
  console.log(`📂 Config file location:\n   ${OUTPUT_FILE}\n`);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
