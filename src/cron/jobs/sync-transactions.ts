/**
 * Sync Transactions Cron Job
 * Syncs transactions from Plaid for all users with connected accounts
 *
 * Render Schedule: 0 8 * * * (midnight PST / 8am UTC)
 * Manual Trigger: npm run cron:sync-transactions
 */

import { createPlaidClient } from "../../utils/clients/plaid.js";
import { getSupabase } from "../../storage/supabase.js";
import { TransactionSyncService } from "../../services/transaction-sync.js";
import { UserBatchSyncService } from "../services/user-batch-sync.service.js";
import { CronLogger } from "../utils/cron-logger.js";
import { ClaudeClient } from "../../utils/clients/claude.js";

export interface CronJob {
  name: string;
  description: string;
  run(claudeClient?: ClaudeClient): Promise<void>;
}

export const syncTransactionsJob: CronJob = {
  name: "sync-transactions",
  description: "Daily transaction sync from Plaid for all users",

  async run(claudeClient?: ClaudeClient): Promise<void> {
    // Validate PLAID_ENV is set to production
    if (process.env.PLAID_ENV !== "production") {
      console.error(
        `[SYNC-TRANSACTIONS] ERROR: This job requires PLAID_ENV=production`
      );
      console.error(
        `[SYNC-TRANSACTIONS] Current PLAID_ENV: ${process.env.PLAID_ENV || "not set"}`
      );
      console.error(
        `[SYNC-TRANSACTIONS] Use sync-transactions-sandbox for testing`
      );
      process.exit(1);
    }

    const logger = new CronLogger("sync-transactions");
    const plaidClient = createPlaidClient();
    const supabase = getSupabase();
    const transactionSyncService = new TransactionSyncService(
      plaidClient,
      supabase,
      claudeClient
    );
    const batchSyncService = new UserBatchSyncService();

    await batchSyncService.syncAllUsers({
      logger,
      environment: "production", // Only sync production connections
      syncFn: async (userId, connection) => {
        // Sync all accounts for this connection
        await transactionSyncService.initiateSyncForConnection(
          connection.itemId,
          userId,
          connection.accessToken
        );
      },
    });
  },
};
