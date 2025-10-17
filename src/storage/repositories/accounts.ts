import { getSupabase } from "../supabase.js";

export interface Account {
  id: string;
  user_id: string;
  item_id: string;
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  limit_amount: number | null;
  currency_code: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface PlaidAccountData {
  account_id: string;
  name: string;
  official_name?: string | null;
  type: string;
  subtype?: string | null;
  balances: {
    current: number | null;
    available: number | null;
    limit?: number | null;
    iso_currency_code?: string | null;
  };
}

/**
 * Upsert accounts for a user and item (institution connection).
 * This is called after fetching account data from Plaid.
 */
export async function upsertAccounts(
  userId: string,
  itemId: string,
  accounts: PlaidAccountData[]
): Promise<Account[]> {
  const now = new Date().toISOString();

  const accountsToUpsert = accounts.map((account) => ({
    user_id: userId,
    item_id: itemId,
    account_id: account.account_id,
    name: account.name,
    official_name: account.official_name || null,
    type: account.type,
    subtype: account.subtype || null,
    current_balance: account.balances.current,
    available_balance: account.balances.available,
    limit_amount: account.balances.limit || null,
    currency_code: account.balances.iso_currency_code || "USD",
    last_synced_at: now,
    updated_at: now,
  }));

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("accounts")
    .upsert(accountsToUpsert, {
      onConflict: "user_id,account_id",
      ignoreDuplicates: false,
    })
    .select();

  if (error) {
    throw new Error(`Failed to upsert accounts: ${error.message}`);
  }

  return data as Account[];
}

/**
 * Get all accounts for a user across all connected institutions.
 */
export async function getAccountsByUserId(userId: string): Promise<Account[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch accounts: ${error.message}`);
  }

  return data as Account[];
}

/**
 * Get accounts for a specific institution connection.
 */
export async function getAccountsByItemId(
  userId: string,
  itemId: string
): Promise<Account[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch accounts for item: ${error.message}`);
  }

  return data as Account[];
}
