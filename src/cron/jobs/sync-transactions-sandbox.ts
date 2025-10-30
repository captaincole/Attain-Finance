/**
 * Sync Transactions (Sandbox Only) Cron Job
 * Syncs transactions AND investment holdings from Plaid for users with SANDBOX connections only
 * Used for testing/development without affecting production data
 *
 * Manual Trigger: npm run cron:sync-transactions-sandbox
 */

import { createPlaidClient } from "../../utils/clients/plaid.js";
import { getSupabase } from "../../storage/supabase.js";
import { TransactionSyncService } from "../../services/transaction-sync.js";
import { InvestmentSyncService } from "../../services/investment-sync.js";
import { UserBatchSyncService } from "../services/user-batch-sync.service.js";
import { ClaudeClient } from "../../utils/clients/claude.js";
import { logEvent } from "../../utils/logger.js";

export interface CronJob {
  name: string;
  description: string;
  run(claudeClient?: ClaudeClient): Promise<void>;
}

export const syncTransactionsSandboxJob: CronJob = {
  name: "sync-transactions-sandbox",
  description: "Transaction and investment holdings sync for SANDBOX Plaid connections only (testing)",

  async run(claudeClient?: ClaudeClient): Promise<void> {
    // Validate PLAID_ENV is set to sandbox
    if (process.env.PLAID_ENV === "production") {
      logEvent(
        "CRON:sync-transactions-sandbox",
        "invalid-environment",
        {
          plaidEnv: process.env.PLAID_ENV,
          message: "This job cannot run with PLAID_ENV=production. Use sync-transactions for production.",
        },
        "error"
      );
      process.exit(1);
    }

    const plaidClient = createPlaidClient();
    const supabase = getSupabase();
    const transactionSyncService = new TransactionSyncService(
      plaidClient,
      supabase,
      claudeClient
    );
    const investmentSyncService = new InvestmentSyncService(
      plaidClient,
      supabase
    );
    const batchSyncService = new UserBatchSyncService();

    await batchSyncService.syncAllUsers({
      environment: "sandbox", // Only sync sandbox connections
      syncFn: async (userId, connection) => {
        // Sync transactions for all accounts
        await transactionSyncService.initiateSyncForConnection(
          connection.itemId,
          userId,
          connection.accessToken
        );

        // Sync investment holdings for investment accounts
        try {
          await investmentSyncService.syncConnectionInvestments({
            itemId: connection.itemId,
            userId,
            accessToken: connection.accessToken,
          });
        } catch (error: any) {
          // Log error but continue - don't fail entire job if investments fail
          logEvent(
            "CRON:sync-transactions-sandbox",
            "investment-sync-error",
            {
              userId,
              itemId: connection.itemId,
              error: error.message,
            },
            "warn"
          );
        }
      },
    });
  },
};
