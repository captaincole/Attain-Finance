#!/usr/bin/env node
/**
 * Cron Job Runner
 * CLI entry point for all cron jobs
 *
 * Usage:
 *   npm run cron <job-name>
 *   npm run cron --list
 *
 * Examples:
 *   npm run cron sync-transactions
 *   npm run cron --list
 */

import dotenv from "dotenv";
import { syncTransactionsJob } from "./jobs/sync-transactions.js";
import { syncTransactionsSandboxJob } from "./jobs/sync-transactions-sandbox.js";

// Load environment variables
dotenv.config();

// Registry of all available jobs
const jobs = {
  "sync-transactions": syncTransactionsJob,
  "sync-transactions-sandbox": syncTransactionsSandboxJob,
  // Future jobs:
  // "sync-balances": syncBalancesJob,
  // "process-recurring": processRecurringJob,
  // "cleanup-old-data": cleanupOldDataJob,
};

/**
 * List all available jobs
 */
function listJobs(): void {
  console.log("\n📋 Available Cron Jobs:\n");

  Object.entries(jobs).forEach(([name, job]) => {
    console.log(`   ${name}`);
    console.log(`   └─ ${job.description}\n`);
  });

  console.log("Usage: npm run cron <job-name>\n");
}

/**
 * Run a specific job
 */
async function runJob(jobName: string): Promise<void> {
  const job = jobs[jobName as keyof typeof jobs];

  if (!job) {
    console.error(`\n❌ Error: Unknown job "${jobName}"\n`);
    listJobs();
    process.exit(1);
  }

  try {
    await job.run();
  } catch (error: any) {
    console.error(`\n❌ Fatal error in job "${jobName}":`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("\n❌ Error: No job specified\n");
    listJobs();
    process.exit(1);
  }

  const command = args[0];

  if (command === "--list" || command === "-l") {
    listJobs();
    return;
  }

  await runJob(command);
}

// Run the CLI
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
