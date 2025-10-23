#!/usr/bin/env node

import dotenv from "dotenv";

import { runDemoInvestmentSeed } from "./demo-investments-runner.js";

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
    console.log("\n🧹 Resetting demo investments");
    console.log("----------------------------");
    console.log(`User ID: ${userId}`);

    const snapshot = await runDemoInvestmentSeed(userId, { reset: true });

    console.log("\n✅ Demo investments reset");
    console.log(
      `Accounts: ${snapshot.accounts.length}, Holdings: ${snapshot.holdings.length}, Securities: ${snapshot.securities.length}`
    );
    console.log(
      `Total Value: $${snapshot.totals.totalValue.toFixed(2)} (Cash: $${snapshot.totals.totalCash.toFixed(
        2
      )}, Invested: $${snapshot.totals.totalInvested.toFixed(2)})`
    );
    console.log();
  } catch (error: any) {
    console.error("\n❌ Failed to reset demo investments");
    console.error(error.message || error);
    process.exit(1);
  }
}

await main();
