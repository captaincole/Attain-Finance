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
 *   npm run cron plaid-sync
 *   npm run cron --list
 */

import dotenv from "dotenv";
import { plaidSyncJob } from "./jobs/plaid-sync.js";
import { plaidSyncSandboxJob } from "./jobs/plaid-sync-sandbox.js";
import { logEvent, serializeError } from "../utils/logger.js";

// Load environment variables
dotenv.config();

// Registry of all available jobs
const jobs = {
  "plaid-sync": plaidSyncJob,
  "plaid-sync-sandbox": plaidSyncSandboxJob,
  // Future jobs:
  // "identity-sync": identitySyncJob,
  // "liabilities-sync": liabilitiesSyncJob,
  // "cleanup-old-data": cleanupOldDataJob,
};

/**
 * List all available jobs
 */
function listJobs(): void {
  logEvent("CRON:runner", "list-start");

  Object.entries(jobs).forEach(([name, job]) => {
    logEvent("CRON:runner", "list-entry", { name, description: job.description });
  });

  logEvent("CRON:runner", "list-usage", { usage: "npm run cron <job-name>" });
}

/**
 * Run a specific job
 */
async function runJob(jobName: string): Promise<void> {
  const job = jobs[jobName as keyof typeof jobs];

  if (!job) {
    logEvent("CRON:runner", "unknown-job", { jobName }, "error");
    listJobs();
    process.exit(1);
  }

  try {
    await job.run();
  } catch (error: any) {
    logEvent(
      "CRON:runner",
      "job-fatal-error",
      { jobName, error: serializeError(error) },
      "error"
    );
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    logEvent("CRON:runner", "no-job-specified", undefined, "error");
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
  logEvent("CRON:runner", "unhandled-error", { error: serializeError(error) }, "error");
  process.exit(1);
});
