#!/usr/bin/env node
/**
 * Interactive CLI script to reset user data
 * Usage: npm run reset-user -- --userId=user_xxx
 */

import readline from "readline";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface UserDataSummary {
  userId: string;
  summary: {
    hasConnections: boolean;
    hasAccounts: boolean;
    hasTransactions: boolean;
    hasBudgets: boolean;
    hasRules: boolean;
    connectionCount: number;
    accountCount: number;
    transactionCount: number;
    budgetCount: number;
    ruleCount: number;
  };
  message: string;
}

interface DeletionResponse {
  success: boolean;
  message: string;
  before: {
    connectionCount: number;
    accountCount: number;
    transactionCount: number;
    budgetCount: number;
    ruleCount: number;
  };
  deleted: {
    userId: string;
    budgetsDeleted: number;
    rulesDeleted: number;
    sessionsDeleted: number;
    connectionsDeleted: number;
    accountsDeleted: number;
    transactionsDeleted: number;
    syncStatesDeleted: number;
  };
}

/**
 * Pretty print JSON with colors
 */
function prettyPrint(data: any) {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Fetch user data summary
 */
async function getUserDataSummary(userId: string): Promise<UserDataSummary> {
  const url = `${BASE_URL}/admin/user/${userId}/data-summary`;
  console.log(`\n📊 Fetching data summary for user: ${userId}`);
  console.log(`   GET ${url}\n`);

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to fetch user data: ${error.error || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Delete user data
 */
async function deleteUserData(userId: string): Promise<DeletionResponse> {
  const url = `${BASE_URL}/admin/user/${userId}/data?confirm=DELETE_ALL_DATA`;
  console.log(`\n🗑️  Deleting all data for user: ${userId}`);
  console.log(`   DELETE ${url}\n`);

  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to delete user data: ${error.error || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Prompt user for confirmation
 */
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

/**
 * Main script
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const userIdArg = args.find((arg) => arg.startsWith("--userId="));

  if (!userIdArg) {
    console.error("❌ Error: Missing required argument --userId");
    console.log("\nUsage:");
    console.log("  npm run reset-user -- --userId=user_xxx");
    console.log("\nExample:");
    console.log("  npm run reset-user -- --userId=user_2abc123def456\n");
    process.exit(1);
  }

  const userId = userIdArg.split("=")[1];

  if (!userId) {
    console.error("❌ Error: userId cannot be empty");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🔧 User Data Reset Tool");
  console.log("=".repeat(60));

  try {
    // Step 1: Fetch and display user data summary
    const summary = await getUserDataSummary(userId);

    console.log("📋 Current Data Summary:");
    console.log("-".repeat(60));
    prettyPrint(summary);
    console.log("-".repeat(60));

    // Check if user has any data
    const hasAnyData =
      summary.summary.hasConnections ||
      summary.summary.hasAccounts ||
      summary.summary.hasTransactions ||
      summary.summary.hasBudgets ||
      summary.summary.hasRules;

    if (!hasAnyData) {
      console.log("\n✅ User has no data. Nothing to delete.");
      process.exit(0);
    }

    // Step 2: Confirm deletion
    console.log("\n⚠️  WARNING: This action cannot be undone!");
    console.log("   This will delete:");
    if (summary.summary.connectionCount > 0) {
      console.log(`   • ${summary.summary.connectionCount} connection(s)`);
    }
    if (summary.summary.accountCount > 0) {
      console.log(`   • ${summary.summary.accountCount} account(s)`);
    }
    if (summary.summary.transactionCount > 0) {
      console.log(`   • ${summary.summary.transactionCount} transaction(s)`);
    }
    if (summary.summary.budgetCount > 0) {
      console.log(`   • ${summary.summary.budgetCount} budget(s)`);
    }
    if (summary.summary.ruleCount > 0) {
      console.log(`   • ${summary.summary.ruleCount} categorization rule(s)`);
    }

    const shouldDelete = await confirm(
      "\n❓ Do you want to delete ALL this data? (y/n): "
    );

    if (!shouldDelete) {
      console.log("\n🚫 Deletion cancelled. No data was deleted.\n");
      process.exit(0);
    }

    // Step 3: Delete user data
    const deletionResult = await deleteUserData(userId);

    console.log("✅ Deletion Complete!");
    console.log("-".repeat(60));
    prettyPrint(deletionResult);
    console.log("-".repeat(60));

    console.log("\n📝 Summary:");
    console.log(
      `   • Connections deleted: ${deletionResult.deleted.connectionsDeleted}`
    );
    console.log(
      `   • Accounts deleted: ${deletionResult.deleted.accountsDeleted}`
    );
    console.log(
      `   • Transactions deleted: ${deletionResult.deleted.transactionsDeleted}`
    );
    console.log(
      `   • Sync states deleted: ${deletionResult.deleted.syncStatesDeleted}`
    );
    console.log(
      `   • Budgets deleted: ${deletionResult.deleted.budgetsDeleted}`
    );
    console.log(
      `   • Rules deleted: ${deletionResult.deleted.rulesDeleted}`
    );
    console.log(
      `   • Sessions deleted: ${deletionResult.deleted.sessionsDeleted}`
    );

    console.log("\n✨ User data has been reset successfully!");
    console.log("💡 Next step: Delete user from Clerk dashboard\n");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error("\nTroubleshooting:");
    console.error("  • Make sure the server is running");
    console.error(`  • Check BASE_URL: ${BASE_URL}`);
    console.error("  • Verify PLAID_ENV is not set to 'production'\n");
    process.exit(1);
  }
}

// Run the script
main();
