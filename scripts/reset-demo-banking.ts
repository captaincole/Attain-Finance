#!/usr/bin/env node

import dotenv from "dotenv";

import { runDemoBankSeed } from "./demo-banking-runner.js";

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
    console.log("\n🧹 Resetting demo banking account");
    console.log("-------------------------------");
    console.log(`User ID: ${userId}`);

    const snapshot = await runDemoBankSeed(userId, { reset: true });

    if (!snapshot) {
      throw new Error("Bank snapshot not available after reset");
    }

    console.log("\n✅ Demo banking account reset");
    console.log(
      `Institution: ${snapshot.account.institution_name} (${snapshot.account.name})`
    );
    console.log(
      `Balance: $${snapshot.account.balances_current.toFixed(2)} with ${snapshot.transactions.length} recent transactions`
    );
    if (snapshot.lastDeposit) {
      console.log(
        `Last deposit: $${snapshot.lastDeposit.amount.toFixed(2)} on ${snapshot.lastDeposit.date}`
      );
    }
    if (snapshot.recentPayments.length > 0) {
      console.log(
        `Recent payment: $${Math.abs(snapshot.recentPayments[0].amount).toFixed(2)} on ${snapshot.recentPayments[0].date}`
      );
    }
    console.log();
  } catch (error: any) {
    console.error("\n❌ Failed to reset demo banking account");
    console.error(error.message || error);
    process.exit(1);
  }
}

await main();
