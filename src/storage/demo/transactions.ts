import { getSupabase } from "../supabase.js";
import {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "../database.types.js";
import { logServiceEvent, serializeError } from "../../utils/logger.js";

export type DemoTransactionAccount = Tables<"demo_transaction_accounts">;
export type DemoTransaction = Tables<"demo_transactions">;

export type DemoTransactionAccountInsert =
  TablesInsert<"demo_transaction_accounts">;
export type DemoTransactionInsert = TablesInsert<"demo_transactions">;

export type DemoTransactionAccountUpdate =
  TablesUpdate<"demo_transaction_accounts">;
export type DemoTransactionUpdate = TablesUpdate<"demo_transactions">;

export interface DemoTransactionSeedData {
  account: DemoTransactionAccountInsert;
  transactions: DemoTransactionInsert[];
}

export interface TransactionQueryOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionCategoryTotal {
  category: string;
  amount: number;
  transactionCount: number;
}

export interface DemoTransactionSnapshot {
  account: DemoTransactionAccount | null;
  transactions: DemoTransaction[];
  categoryTotals: TransactionCategoryTotal[];
  spendingTotal: number;
  paymentsTotal: number;
  incomeTotal: number;
}

function ensureNumber(value?: number | null): number {
  return typeof value === "number" ? Number(value) : 0;
}

export async function deleteDemoTransactions(userId: string): Promise<void> {
  const supabase = getSupabase();

  const txResult = await supabase
    .from("demo_transactions")
    .delete()
    .eq("user_id", userId);

  if (txResult.error) {
    logServiceEvent(
      "demo-transactions",
      "delete-transactions-error",
      { userId, error: serializeError(txResult.error) },
      "error"
    );
    throw new Error(
      `Failed to delete demo transactions: ${txResult.error.message}`
    );
  }

  const accountResult = await supabase
    .from("demo_transaction_accounts")
    .delete()
    .eq("user_id", userId);

  if (accountResult.error) {
    logServiceEvent(
      "demo-transactions",
      "delete-accounts-error",
      { userId, error: serializeError(accountResult.error) },
      "error"
    );
    throw new Error(
      `Failed to delete demo transaction account: ${accountResult.error.message}`
    );
  }
}

export async function upsertDemoTransactions(
  data: DemoTransactionSeedData
): Promise<void> {
  const supabase = getSupabase();

  const { error: accountError } = await supabase
    .from("demo_transaction_accounts")
    .upsert(data.account, { onConflict: "account_id" });

  if (accountError) {
    logServiceEvent(
      "demo-transactions",
      "upsert-account-error",
      { error: serializeError(accountError) },
      "error"
    );
    throw new Error(`Failed to upsert demo transaction account: ${accountError.message}`);
  }

  if (data.transactions.length > 0) {
    const { error: txError } = await supabase
      .from("demo_transactions")
      .upsert(data.transactions, { onConflict: "transaction_id" });

    if (txError) {
      logServiceEvent(
        "demo-transactions",
        "upsert-transactions-error",
        { error: serializeError(txError) },
        "error"
      );
      throw new Error(`Failed to upsert demo transactions: ${txError.message}`);
    }
  }
}

export async function getDemoTransactions(
  userId: string,
  options: TransactionQueryOptions = {}
): Promise<DemoTransactionSnapshot> {
  const supabase = getSupabase();

  const { data: accountData, error: accountError } = await supabase
    .from("demo_transaction_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (accountError) {
    logServiceEvent(
      "demo-transactions",
      "fetch-account-error",
      { userId, error: serializeError(accountError) },
      "error"
    );
    throw new Error(`Failed to fetch demo transaction account: ${accountError.message}`);
  }

  let query = supabase
    .from("demo_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.startDate) {
    query = query.gte("date", options.startDate);
  }
  if (options.endDate) {
    query = query.lte("date", options.endDate);
  }
  if (typeof options.limit === "number") {
    query = query.limit(options.limit);
  }
  if (typeof options.offset === "number") {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
  }

  const { data: transactions, error: txError } = await query;

  if (txError) {
    logServiceEvent(
      "demo-transactions",
      "fetch-transactions-error",
      { userId, error: serializeError(txError) },
      "error"
    );
    throw new Error(`Failed to fetch demo transactions: ${txError.message}`);
  }

  const spendingCategories = new Map<string, { amount: number; count: number }>();
  let spendingTotal = 0;
  let paymentsTotal = 0;
  let incomeTotal = 0;

  (transactions || []).forEach((tx) => {
    const amount = ensureNumber(tx.amount);
    if (tx.direction === "debit") {
      spendingTotal += Math.abs(amount);
      const key = tx.category || "Other";
      const existing = spendingCategories.get(key) || { amount: 0, count: 0 };
      existing.amount += Math.abs(amount);
      existing.count += 1;
      spendingCategories.set(key, existing);
    } else if (tx.direction === "credit") {
      incomeTotal += Math.abs(amount);
    }

    if (tx.category && tx.category.toLowerCase().includes("payment")) {
      paymentsTotal += Math.abs(amount);
    }
  });

  const categoryTotals: TransactionCategoryTotal[] = Array.from(
    spendingCategories.entries()
  )
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    account: (accountData as DemoTransactionAccount) || null,
    transactions: (transactions || []) as DemoTransaction[],
    categoryTotals,
    spendingTotal,
    paymentsTotal,
    incomeTotal,
  };
}
