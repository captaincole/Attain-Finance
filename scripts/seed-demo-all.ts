#!/usr/bin/env node

import dotenv from "dotenv";

import { runDemoBankSeed } from "./demo-banking-runner.js";
import { runDemoInvestmentSeed } from "./demo-investments-runner.js";
import { runDemoLiabilitySeed } from "./demo-liabilities-runner.js";
import { runDemoTransactionsSeed } from "./demo-transactions-runner.js";

dotenv.config();

interface CliArgs {
  userId: string;
  banking: boolean;
  investments: boolean;
  liabilities: boolean;
  transactions: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const userIdArg = args.find((arg) => arg.startsWith("--userId="));

  if (!userIdArg) {
    throw new Error("Missing required argument: --userId=<demo_user_id>");
  }

  const userId = userIdArg.split("=")[1]?.trim();

  if (!userId) {
    throw new Error("User ID cannot be empty.");
  }

  const flags = new Set(args);

  return {
    userId,
    banking: !flags.has("--skip-banking"),
    investments: !flags.has("--skip-investments"),
    liabilities: !flags.has("--skip-liabilities"),
    transactions: !flags.has("--skip-transactions"),
  };
}

async function main() {
  try {
    const options = parseArgs();
    const { userId } = options;

    console.log("\n🌱 Seeding demo datasets");
    console.log("-----------------------");
    console.log(`User ID: ${userId}`);
    console.log(
      `Included datasets: ${[
        options.banking ? "banking" : null,
        options.investments ? "investments" : null,
        options.liabilities ? "liabilities" : null,
        options.transactions ? "transactions" : null,
      ]
        .filter(Boolean)
        .join(", ") || "none"}`
    );

    if (options.banking) {
      console.log("\n🏦 Banking");
      const snapshot = await runDemoBankSeed(userId, { reset: true });
      if (!snapshot) {
        throw new Error("Banking snapshot unavailable after seed.");
      }
      console.log(
        `  Account: ${snapshot.account.institution_name} (${snapshot.account.name})`
      );
      console.log(
        `  Balance: $${snapshot.account.balances_current.toFixed(2)}`
      );
      console.log(
        `  Transactions: ${snapshot.transactions.length} recent entries`
      );
    } else {
      console.log("\n🏦 Banking (skipped)");
    }

    if (options.investments) {
      console.log("\n📈 Investments");
      const snapshot = await runDemoInvestmentSeed(userId, { reset: true });
      console.log(
        `  Accounts: ${snapshot.accounts.length}, Holdings: ${snapshot.holdings.length}`
      );
      console.log(`  Total Value: $${snapshot.totals.totalValue.toFixed(2)}`);
    } else {
      console.log("\n📈 Investments (skipped)");
    }

    if (options.liabilities) {
      console.log("\n🚗 Liabilities");
      const snapshot = await runDemoLiabilitySeed(userId, { reset: true });
      console.log(`  Accounts: ${snapshot.accounts.length}`);
      console.log(
        `  Total Balance: $${snapshot.totals.totalBalance.toFixed(2)}`
      );
      console.log(
        `  Minimum Payments: $${snapshot.totals.totalMinimumPayment.toFixed(2)}`
      );
    } else {
      console.log("\n🚗 Liabilities (skipped)");
    }

    if (options.transactions) {
      console.log("\n💳 Transactions");
      const snapshot = await runDemoTransactionsSeed(userId, { reset: true });
      console.log(`  Transactions: ${snapshot.transactions.length}`);
      console.log(
        `  Spending Total: $${snapshot.spendingTotal.toFixed(2)} | Payments: $${snapshot.paymentsTotal.toFixed(2)}`
      );
    } else {
      console.log("\n💳 Transactions (skipped)");
    }

    console.log("\n✅ Demo datasets seeded\n");
  } catch (error: any) {
    console.error("\n❌ Failed to seed demo datasets");
    console.error(error.message || error);
    process.exit(1);
  }
}

await main();
