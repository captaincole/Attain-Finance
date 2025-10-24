#!/usr/bin/env node

import dotenv from "dotenv";

import { runDemoLiabilitySeed } from "./demo-liabilities-runner.js";

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
    console.log("\n🔧 Seeding demo liabilities");
    console.log("---------------------------");
    console.log(`User ID: ${userId}`);
    console.log(`Reset existing data: ${skipReset ? "no" : "yes"}`);

    const snapshot = await runDemoLiabilitySeed(userId, {
      reset: !skipReset,
    });

    console.log("\n✅ Demo liabilities seeded");
    console.log(
      `Accounts: ${snapshot.accounts.length}, Total Balance: $${snapshot.totals.totalBalance.toFixed(
        2
      )}`
    );
    console.log(
      `Minimum Payments Total: $${snapshot.totals.totalMinimumPayment.toFixed(2)}`
    );
    if (snapshot.creditScore) {
      console.log(
        `Credit Score: ${snapshot.creditScore.score} (as of ${snapshot.creditScore.score_date})`
      );
    }
    console.log();
  } catch (error: any) {
    console.error("\n❌ Failed to seed demo liabilities");
    console.error(error.message || error);
    process.exit(1);
  }
}

await main();
