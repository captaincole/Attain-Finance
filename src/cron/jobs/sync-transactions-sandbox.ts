/**
 * Sync Transactions (Sandbox Only) Cron Job
 * Syncs transactions from Plaid for users with SANDBOX connections only
 * Used for testing/development without affecting production data
 *
 * Manual Trigger: npm run cron:sync-transactions-sandbox
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

export const syncTransactionsSandboxJob: CronJob = {
  name: "sync-transactions-sandbox",
  description: "Transaction sync for SANDBOX Plaid connections only (testing)",

  async run(claudeClient?: ClaudeClient): Promise<void> {
    // Validate PLAID_ENV is set to sandbox
    if (process.env.PLAID_ENV === "production") {
      console.error(
        `[SYNC-TRANSACTIONS-SANDBOX] ERROR: This job cannot run with PLAID_ENV=production`
      );
      console.error(
        `[SYNC-TRANSACTIONS-SANDBOX] Use sync-transactions for production`
      );
      process.exit(1);
    }

    const logger = new CronLogger("sync-transactions-sandbox");
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
      environment: "sandbox", // Only sync sandbox connections
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
