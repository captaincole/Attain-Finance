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

export interface CronJob {
  name: string;
  description: string;
  run(): Promise<void>;
}

export const syncTransactionsSandboxJob: CronJob = {
  name: "sync-transactions-sandbox",
  description: "Transaction sync for SANDBOX Plaid connections only (testing)",

  async run(): Promise<void> {
    const logger = new CronLogger("sync-transactions-sandbox");
    const plaidClient = createPlaidClient();
    const supabase = getSupabase();
    const transactionSyncService = new TransactionSyncService(
      plaidClient,
      supabase
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
