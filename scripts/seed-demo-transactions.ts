#!/usr/bin/env node

import dotenv from "dotenv";

import { runDemoTransactionsSeed } from "./demo-transactions-runner.js";

dotenv.config();

interface CliArgs {
  userId: string;
  skipReset: boolean;
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

  const skipReset =
    args.includes("--skip-reset") || args.includes("--skipReset");

  return { userId, skipReset };
}

async function main() {
  try {
    const { userId, skipReset } = parseArgs();
    console.log("\n🔧 Seeding demo credit card transactions");
    console.log("---------------------------------------");
    console.log(`User ID: ${userId}`);
    console.log(`Reset existing data: ${skipReset ? "no" : "yes"}`);

    const snapshot = await runDemoTransactionsSeed(userId, {
      reset: !skipReset,
    });

    console.log("\n✅ Demo transactions seeded");
    console.log(`Transactions: ${snapshot.transactions.length}`);
    console.log(`Spending total: $${snapshot.spendingTotal.toFixed(2)}`);
    if (snapshot.categoryTotals.length > 0) {
      console.log(
        `Top category: ${snapshot.categoryTotals[0].category} ($${snapshot.categoryTotals[0].amount.toFixed(2)})`
      );
    }
    console.log();
  } catch (error: any) {
    console.error("\n❌ Failed to seed demo transactions");
    console.error(error.message || error);
    process.exit(1);
  }
}

await main();
