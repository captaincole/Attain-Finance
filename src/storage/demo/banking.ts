import { getSupabase } from "../supabase.js";
import {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "../database.types.js";
import { logServiceEvent, serializeError } from "../../utils/logger.js";

export type DemoBankAccount = Tables<"demo_banking_accounts">;
export type DemoBankTransaction = Tables<"demo_banking_transactions">;

export type DemoBankAccountInsert = TablesInsert<"demo_banking_accounts">;
export type DemoBankTransactionInsert =
  TablesInsert<"demo_banking_transactions">;

export type DemoBankAccountUpdate = TablesUpdate<"demo_banking_accounts">;
export type DemoBankTransactionUpdate =
  TablesUpdate<"demo_banking_transactions">;

export interface DemoBankSeedData {
  account: DemoBankAccountInsert;
  transactions: DemoBankTransactionInsert[];
}

export interface DemoBankSnapshot {
  account: DemoBankAccount;
  transactions: DemoBankTransaction[];
  lastDeposit: DemoBankTransaction | null;
  recentPayments: DemoBankTransaction[];
  monthlySummary: {
    inflow: number;
    outflow: number;
  };
}

function ensureNumber(value?: number | null): number {
  return typeof value === "number" ? value : 0;
}

export async function deleteDemoBankData(userId: string): Promise<void> {
  const supabase = getSupabase();

  const txResult = await supabase
    .from("demo_banking_transactions")
    .delete()
    .eq("user_id", userId);

  if (txResult.error) {
    logServiceEvent(
      "demo-banking",
      "delete-transactions-error",
      { userId, error: serializeError(txResult.error) },
      "error"
    );
    throw new Error(
      `Failed to delete demo banking transactions: ${txResult.error.message}`
    );
  }

  const accountResult = await supabase
    .from("demo_banking_accounts")
    .delete()
    .eq("user_id", userId);

  if (accountResult.error) {
    logServiceEvent(
      "demo-banking",
      "delete-accounts-error",
      { userId, error: serializeError(accountResult.error) },
      "error"
    );
    throw new Error(
      `Failed to delete demo banking account: ${accountResult.error.message}`
    );
  }
}

export async function upsertDemoBankData(
  data: DemoBankSeedData
): Promise<void> {
  const supabase = getSupabase();

  const { error: accountError } = await supabase
    .from("demo_banking_accounts")
    .upsert(data.account, { onConflict: "account_id" });

  if (accountError) {
    logServiceEvent(
      "demo-banking",
      "upsert-account-error",
      { error: serializeError(accountError) },
      "error"
    );
    throw new Error(`Failed to upsert demo banking account: ${accountError.message}`);
  }

  if (data.transactions.length > 0) {
    const { error: txError } = await supabase
      .from("demo_banking_transactions")
      .upsert(data.transactions, { onConflict: "id" });

    if (txError) {
      logServiceEvent(
        "demo-banking",
        "upsert-transactions-error",
        { error: serializeError(txError) },
        "error"
      );
      throw new Error(`Failed to upsert demo banking transactions: ${txError.message}`);
    }
  }
}

export async function getDemoBankSnapshot(
  userId: string
): Promise<DemoBankSnapshot | null> {
  const supabase = getSupabase();

  const { data: account, error: accountError } = await supabase
    .from("demo_banking_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (accountError) {
    logServiceEvent(
      "demo-banking",
      "fetch-account-error",
      { userId, error: serializeError(accountError) },
      "error"
    );
    throw new Error(`Failed to fetch demo banking account: ${accountError.message}`);
  }

  if (!account) {
    return null;
  }

  const { data: transactions, error: txError } = await supabase
    .from("demo_banking_transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", account.account_id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (txError) {
    logServiceEvent(
      "demo-banking",
      "fetch-transactions-error",
      { userId, error: serializeError(txError) },
      "error"
    );
    throw new Error(`Failed to fetch demo banking transactions: ${txError.message}`);
  }

  const credits = (transactions || []).filter(
    (tx) => tx.direction === "credit"
  );
  const debits = (transactions || []).filter(
    (tx) => tx.direction === "debit"
  );

  const lastDeposit = credits.length > 0 ? credits[0] : null;
  const recentPayments = debits.slice(0, 2);

  const inflow = credits.reduce((sum, tx) => sum + ensureNumber(tx.amount), 0);
  const outflow = debits.reduce((sum, tx) => sum + Math.abs(ensureNumber(tx.amount)), 0);

  return {
    account: account as DemoBankAccount,
    transactions: (transactions || []) as DemoBankTransaction[],
    lastDeposit,
    recentPayments,
    monthlySummary: {
      inflow,
      outflow,
    },
  };
}
