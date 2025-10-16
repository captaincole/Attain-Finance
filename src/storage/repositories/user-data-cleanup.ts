/**
 * User Data Cleanup Repository
 * Functions for deleting all user data (testing/development only)
 */

import { getSupabase } from "../supabase.js";

export interface UserDataDeletionSummary {
  userId: string;
  budgetsDeleted: number;
  rulesDeleted: number;
  sessionsDeleted: number;
  connectionsDeleted: number;
  accountsDeleted: number;
  transactionsDeleted: number;
  syncStatesDeleted: number;
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

  console.log(`[USER-DATA-CLEANUP] Starting deletion for user ${userId}`);

  // Step 1: Delete budgets
  const { error: budgetError, count: budgetsDeleted } = await supabase
    .from("budgets")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (budgetError) {
    throw new Error(`Failed to delete budgets: ${budgetError.message}`);
  }

  console.log(`[USER-DATA-CLEANUP] Deleted ${budgetsDeleted || 0} budgets`);

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

  console.log(
    `[USER-DATA-CLEANUP] Deleted ${rulesDeleted || 0} categorization rules`
  );

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

  console.log(
    `[USER-DATA-CLEANUP] Deleted ${sessionsDeleted || 0} account sessions`
  );

  // Step 4: Count related records before cascade deletion
  const { count: accountsCount } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: transactionsCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get account IDs first, then count sync states
  const { data: userAccounts } = await supabase
    .from("accounts")
    .select("account_id")
    .eq("user_id", userId);

  const accountIds = userAccounts?.map((a) => a.account_id) || [];
  let syncStatesCount = 0;

  if (accountIds.length > 0) {
    const { count } = await supabase
      .from("account_sync_state")
      .select("*", { count: "exact", head: true })
      .in("account_id", accountIds);
    syncStatesCount = count || 0;
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

  console.log(
    `[USER-DATA-CLEANUP] Deleted ${connectionsDeleted || 0} plaid connections`
  );
  console.log(
    `[USER-DATA-CLEANUP] Cascade deleted ~${accountsCount || 0} accounts, ~${transactionsCount || 0} transactions, ~${syncStatesCount || 0} sync states`
  );

  const summary: UserDataDeletionSummary = {
    userId,
    budgetsDeleted: budgetsDeleted || 0,
    rulesDeleted: rulesDeleted || 0,
    sessionsDeleted: sessionsDeleted || 0,
    connectionsDeleted: connectionsDeleted || 0,
    accountsDeleted: accountsCount || 0,
    transactionsDeleted: transactionsCount || 0,
    syncStatesDeleted: syncStatesCount || 0,
  };

  console.log(`[USER-DATA-CLEANUP] ✓ Deletion complete:`, summary);

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
