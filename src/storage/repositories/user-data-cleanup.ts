/**
 * User Data Cleanup Repository
 * Functions for deleting all user data (testing/development only)
 */

import { getSupabase } from "../supabase.js";
import { logEvent } from "../../utils/logger.js";

export interface UserDataDeletionSummary {
  userId: string;
  budgetsDeleted: number;
  rulesDeleted: number;
  sessionsDeleted: number;
  connectionsDeleted: number;
  accountsDeleted: number;
  transactionsDeleted: number;
  syncStatesDeleted: number;
  investmentHoldingsDeleted: number;
}

/**
 * Delete ALL user data from the database
 * This is destructive and cannot be undone!
 *
 * Deletion order matters:
 * 1. Budgets (no foreign keys)
 * 2. Categorization rules (no foreign keys)
 * 3. Account sessions (no foreign keys)
 * 4. Plaid connections (triggers cascades for accounts, transactions, sync states)
 */
export async function deleteAllUserData(
  userId: string
): Promise<UserDataDeletionSummary> {
  const supabase = getSupabase();

  logEvent("USER-DATA-CLEANUP", "starting-deletion", { userId });

  // Step 1: Delete budgets
  const { error: budgetError, count: budgetsDeleted } = await supabase
    .from("budgets")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (budgetError) {
    throw new Error(`Failed to delete budgets: ${budgetError.message}`);
  }

  logEvent("USER-DATA-CLEANUP", "deleted-budgets", { userId, count: budgetsDeleted || 0 });

  // Step 2: Delete categorization prompts/rules
  const { error: rulesError, count: rulesDeleted } = await supabase
    .from("categorization_prompts")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (rulesError) {
    throw new Error(
      `Failed to delete categorization rules: ${rulesError.message}`
    );
  }

  logEvent("USER-DATA-CLEANUP", "deleted-rules", { userId, count: rulesDeleted || 0 });

  // Step 3: Delete plaid sessions
  const { error: sessionsError, count: sessionsDeleted } = await supabase
    .from("plaid_sessions")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (sessionsError) {
    throw new Error(
      `Failed to delete account sessions: ${sessionsError.message}`
    );
  }

  logEvent("USER-DATA-CLEANUP", "deleted-sessions", { userId, count: sessionsDeleted || 0 });

  // Step 4: Count related records before cascade deletion
  const { count: accountsCount } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: transactionsCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get account IDs first, then count sync states and investment holdings
  const { data: userAccounts } = await supabase
    .from("accounts")
    .select("account_id")
    .eq("user_id", userId);

  const accountIds = userAccounts?.map((a) => a.account_id) || [];
  let syncStatesCount = 0;
  let investmentHoldingsCount = 0;

  if (accountIds.length > 0) {
    const { count: syncCount } = await supabase
      .from("account_sync_state")
      .select("*", { count: "exact", head: true })
      .in("account_id", accountIds);
    syncStatesCount = syncCount || 0;

    const { count: holdingsCount } = await supabase
      .from("investment_holdings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    investmentHoldingsCount = holdingsCount || 0;
  }

  // Step 5: Delete plaid connections (triggers cascades)
  const { error: connectionsError, count: connectionsDeleted } = await supabase
    .from("plaid_connections")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (connectionsError) {
    throw new Error(
      `Failed to delete plaid connections: ${connectionsError.message}`
    );
  }

  logEvent("USER-DATA-CLEANUP", "deleted-connections", { userId, count: connectionsDeleted || 0 });
  logEvent("USER-DATA-CLEANUP", "cascade-deleted", {
    userId,
    accounts: accountsCount || 0,
    transactions: transactionsCount || 0,
    syncStates: syncStatesCount || 0,
    investmentHoldings: investmentHoldingsCount || 0
  });

  const summary: UserDataDeletionSummary = {
    userId,
    budgetsDeleted: budgetsDeleted || 0,
    rulesDeleted: rulesDeleted || 0,
    sessionsDeleted: sessionsDeleted || 0,
    connectionsDeleted: connectionsDeleted || 0,
    accountsDeleted: accountsCount || 0,
    transactionsDeleted: transactionsCount || 0,
    syncStatesDeleted: syncStatesCount || 0,
    investmentHoldingsDeleted: investmentHoldingsCount || 0,
  };

  logEvent("USER-DATA-CLEANUP", "deletion-complete", {
    userId: summary.userId,
    budgetsDeleted: summary.budgetsDeleted,
    rulesDeleted: summary.rulesDeleted,
    sessionsDeleted: summary.sessionsDeleted,
    connectionsDeleted: summary.connectionsDeleted,
    accountsDeleted: summary.accountsDeleted,
    transactionsDeleted: summary.transactionsDeleted,
    syncStatesDeleted: summary.syncStatesDeleted,
    investmentHoldingsDeleted: summary.investmentHoldingsDeleted
  });

  return summary;
}

/**
 * Check if a user has any data in the system
 */
export async function getUserDataSummary(userId: string): Promise<{
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
}> {
  const supabase = getSupabase();

  const [connections, accounts, transactions, budgets, rules] =
    await Promise.all([
      supabase
        .from("plaid_connections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("budgets")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("categorization_prompts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

  const connectionCount = connections.count || 0;
  const accountCount = accounts.count || 0;
  const transactionCount = transactions.count || 0;
  const budgetCount = budgets.count || 0;
  const ruleCount = rules.count || 0;

  return {
    hasConnections: connectionCount > 0,
    hasAccounts: accountCount > 0,
    hasTransactions: transactionCount > 0,
    hasBudgets: budgetCount > 0,
    hasRules: ruleCount > 0,
    connectionCount,
    accountCount,
    transactionCount,
    budgetCount,
    ruleCount,
  };
}
