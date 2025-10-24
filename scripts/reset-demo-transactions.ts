#!/usr/bin/env node

import dotenv from "dotenv";

import { runDemoTransactionsSeed } from "./demo-transactions-runner.js";

dotenv.config();

function parseArgs(): string {
  const args = process.argv.slice(2);
  const userIdArg = args.find((arg) => arg.startsWith("--userId="));

  if (!userIdArg) {
    throw new Error("Missing required argument: --userId=<demo_user_id>");
  }

  const userId = userIdArg.split("=")[1]?.trim();

  if (!userId) {
    throw new Error("User ID cannot be empty.");
  }

  return userId;
}

async function main() {
  try {
    const userId = parseArgs();
    console.log("\n🧹 Resetting demo credit card transactions");
    console.log("-----------------------------------------");
    console.log(`User ID: ${userId}`);

    const snapshot = await runDemoTransactionsSeed(userId, { reset: true });

    console.log("\n✅ Demo transactions reset");
    console.log(`Transactions: ${snapshot.transactions.length}`);
    console.log(`Spending total: $${snapshot.spendingTotal.toFixed(2)}`);
    if (snapshot.categoryTotals.length > 0) {
      console.log(
        `Top category: ${snapshot.categoryTotals[0].category} ($${snapshot.categoryTotals[0].amount.toFixed(2)})`
      );
    }
    console.log();
  } catch (error: any) {
    console.error("\n❌ Failed to reset demo transactions");
    console.error(error.message || error);
    process.exit(1);
  }
}

await main();
