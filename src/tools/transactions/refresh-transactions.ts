/**
 * Refresh Transactions Tool
 * Fetches latest data from Plaid, categorizes, and labels for budgets
 *
 * TODO: Integrate TransactionSyncService here for manual refresh
 * This should reuse the same /transactions/sync logic as OAuth callback
 * instead of the current /transactions/get approach.
 * See: src/services/transaction-sync.ts
 */

import { PlaidApi } from "plaid";
import { findAccountConnectionsByUserId } from "../../storage/repositories/account-connections.js";
import {
  upsertTransactions,
  findUncategorizedTransactions,
  updateTransactionCategories,
  Transaction,
} from "../../storage/repositories/transactions.js";
import {
  categorizeTransactions,
  TransactionForCategorization,
  ClaudeClient,
} from "../../utils/clients/claude.js";
import { getCustomRules } from "../../storage/categorization/rules.js";
import { getBudgets } from "../../storage/budgets/budgets.js";
import { labelTransactionsForBudgets } from "../../utils/budget-labeling.js";
import { upsertAccounts, PlaidAccountData } from "../../storage/repositories/accounts.js";
import { logEvent } from "../../utils/logger.js";

/**
 * Refresh Transactions Handler
 * Called by refresh-transactions tool
 */
export async function refreshTransactionsHandler(
  userId: string,
  plaidClient: PlaidApi,
  claudeClient?: ClaudeClient
) {
  logEvent("TOOL/REFRESH-TRANSACTIONS", "starting-refresh", { userId });

  // Step 1: Get user's account connections
  const connections = await findAccountConnectionsByUserId(userId);

  if (connections.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `⚠️ **No Accounts Connected**\n\nConnect an account first using: "Connect my account"`,
        },
      ],
    };
  }

  // Step 2: Fetch all transactions from Plaid (last 2 years)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  const allPlaidTransactions: any[] = [];
  const accountMap = new Map<string, { name: string; institution: string }>();
  const errors: string[] = [];
  let totalAccountsRefreshed = 0;

  for (const connection of connections) {
    try {
      // Get account details (includes balances)
      const accountsResponse = await plaidClient.accountsGet({
        access_token: connection.accessToken,
      });

      const institutionName =
        accountsResponse.data.item.institution_name || "Unknown";

      // Store account balances in database
      const plaidAccounts: PlaidAccountData[] = accountsResponse.data.accounts.map(
        (account) => ({
          account_id: account.account_id,
          name: account.name,
          official_name: account.official_name || null,
          type: account.type,
          subtype: account.subtype || null,
          balances: {
            current: account.balances.current,
            available: account.balances.available,
            limit: account.balances.limit || null,
            iso_currency_code: account.balances.iso_currency_code || null,
          },
        })
      );

      await upsertAccounts(userId, connection.itemId, plaidAccounts);
      totalAccountsRefreshed += plaidAccounts.length;

      // Build account metadata map for transaction labeling
      for (const account of accountsResponse.data.accounts) {
        const accountType = account.subtype || account.type || "Account";
        const mask = account.mask ? `****${account.mask}` : "";
        const accountLabel = mask
          ? `${institutionName} - ${accountType} (${mask})`
          : `${institutionName} - ${accountType}`;

        accountMap.set(account.account_id, {
          name: accountLabel,
          institution: institutionName,
        });
      }

      // Fetch transactions
      const response = await plaidClient.transactionsGet({
        access_token: connection.accessToken,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        options: {
          count: 500,
          offset: 0,
        },
      });

      allPlaidTransactions.push(
        ...response.data.transactions.map((tx) => ({
          ...tx,
          item_id: connection.itemId,
        }))
      );
    } catch (error: any) {
      errors.push(`${connection.itemId}: ${error.message}`);
    }
  }

  logEvent("TOOL/REFRESH-TRANSACTIONS", "fetched-from-plaid", { count: allPlaidTransactions.length });

  if (allPlaidTransactions.length === 0) {
    let errorMsg = `📊 **No Transactions Found**\n\nNo transactions found from your connected accounts.`;

    if (errors.length > 0) {
      errorMsg += `\n\n**Errors:**\n${errors.map(e => `- ${e}`).join('\n')}`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: errorMsg.trim(),
        },
      ],
    };
  }

  // Step 3: Upsert transactions to database
  const transactionsToUpsert: Omit<Transaction, "createdAt" | "updatedAt">[] =
    allPlaidTransactions.map((tx) => {
      const accountInfo = accountMap.get(tx.account_id);
      return {
        transactionId: tx.transaction_id,
        accountId: tx.account_id,
        itemId: tx.item_id,
        userId,
        date: tx.date,
        name: tx.name,
        amount: tx.amount,
        plaidCategory: tx.category || null,
        pending: tx.pending || false,
        customCategory: null, // Will be filled by categorization
        categorizedAt: null,
        budgetIds: null,
        budgetsUpdatedAt: null,
        accountName: accountInfo?.name || null,
        institutionName: accountInfo?.institution || null,
      };
    });

  await upsertTransactions(transactionsToUpsert);
  logEvent("TOOL/REFRESH-TRANSACTIONS", "upserted", { count: transactionsToUpsert.length });

  // Step 4: Categorize uncategorized transactions
  const uncategorized = await findUncategorizedTransactions(userId);
  logEvent("TOOL/REFRESH-TRANSACTIONS", "found-uncategorized", { count: uncategorized.length });

  let categorizationCount = 0;

  if (uncategorized.length > 0) {
    const customRules = await getCustomRules(userId);

    const txsForCategorization: TransactionForCategorization[] =
      uncategorized.map((tx) => ({
        date: tx.date,
        description: tx.name,
        amount: tx.amount.toString(),
        category: tx.plaidCategory?.join(", "),
        account_name: tx.accountName || undefined,
        pending: tx.pending ? "true" : "false",
      }));

    logEvent("TOOL/REFRESH-TRANSACTIONS", "categorizing", { count: txsForCategorization.length });

    try {
      const categorized = await categorizeTransactions(
        txsForCategorization,
        customRules || undefined,
        claudeClient
      );

      // Update categories in database
      const updates = categorized.map((tx, index) => ({
        transactionId: uncategorized[index].transactionId,
        customCategory: tx.custom_category,
      }));

      await updateTransactionCategories(updates);
      categorizationCount = updates.length;
      logEvent("TOOL/REFRESH-TRANSACTIONS", "categorized", { count: categorizationCount });
    } catch (error: any) {
      logEvent("TOOL/REFRESH-TRANSACTIONS", "categorization-error", { error: error.message }, "error");
      errors.push(`Categorization: ${error.message}`);
    }
  }

  // Step 5: Label transactions for budgets
  const budgets = await getBudgets(userId);
  logEvent("TOOL/REFRESH-TRANSACTIONS", "found-budgets", { count: budgets.length });

  let budgetLabelCount = 0;

  if (budgets.length > 0) {
    try {
      budgetLabelCount = await labelTransactionsForBudgets(userId, budgets, claudeClient);
      logEvent("TOOL/REFRESH-TRANSACTIONS", "labeled-for-budgets", { count: budgetLabelCount });
    } catch (error: any) {
      logEvent("TOOL/REFRESH-TRANSACTIONS", "budget-labeling-error", { error: error.message }, "error");
      errors.push(`Budget labeling: ${error.message}`);
    }
  }

  // Build response
  let responseText = `✅ **Transactions & Balances Refreshed**\n\n`;
  responseText += `**Summary:**\n`;
  responseText += `- Accounts Refreshed: ${totalAccountsRefreshed} account(s)\n`;
  responseText += `- Fetched: ${allPlaidTransactions.length} transactions from Plaid\n`;
  responseText += `- Categorized: ${categorizationCount} new transactions\n`;
  responseText += `- Budget Labels: ${budgetLabelCount} transactions labeled\n`;
  responseText += `- Connections: ${connections.length} institution(s)\n\n`;

  if (errors.length > 0) {
    responseText += `**Warnings:**\n${errors.map((e) => `- ${e}`).join("\n")}\n\n`;
  }

  responseText += `**Next Steps:**\n`;
  responseText += `- "Show my account balances" - View updated balances\n`;
  responseText += `- "Get my transactions" - View categorized data\n`;
  responseText += `- "Check my budgets" - See budget status\n`;
  responseText += `- "Update my categorization rules" - Customize categories\n`;

  return {
    content: [
      {
        type: "text" as const,
        text: responseText.trim(),
      },
    ],
  };
}
