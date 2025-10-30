/**
 * Plaid Sync Cron Job
 * Syncs all Plaid data (transactions, investments, account balances) for all users
 *
 * Render Schedule: 0 8 * * * (midnight PST / 8am UTC)
 * Manual Trigger: npm run cron:plaid-sync
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

export const plaidSyncJob: CronJob = {
  name: "plaid-sync",
  description: "Sync all Plaid data (transactions, investments, balances) for all users",

  async run(claudeClient?: ClaudeClient): Promise<void> {
    // Validate PLAID_ENV is set to production
    if (process.env.PLAID_ENV !== "production") {
      logEvent(
        "CRON:plaid-sync",
        "invalid-environment",
        {
          plaidEnv: process.env.PLAID_ENV || "not set",
          message: "This job requires PLAID_ENV=production. Use plaid-sync-sandbox for testing.",
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
      environment: "production", // Only sync production connections
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
            "CRON:plaid-sync",
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
