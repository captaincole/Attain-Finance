/**
 * Investment Holdings Repository
 * Database operations for investment holdings from Plaid Investments API
 */

import { getSupabaseServiceRole } from "../supabase.js";
import type { Database } from "../database.types.js";
import type { Holding, Security } from "plaid";

type InvestmentHoldingRow = Database["public"]["Tables"]["investment_holdings"]["Row"];
type InvestmentHoldingInsert = Database["public"]["Tables"]["investment_holdings"]["Insert"];

export interface InvestmentHoldingWithAccount extends InvestmentHoldingRow {
  account_name?: string;
  account_type?: string;
  account_subtype?: string;
}

/**
 * Upsert investment holdings for an account
 * Merges holdings and securities data into denormalized storage
 * @param userId - User ID
 * @param accountId - Plaid account_id
 * @param holdings - Array of Plaid holdings
 * @param securities - Array of Plaid securities (for metadata lookup)
 */
export async function upsertHoldingsForAccount(
  userId: string,
  accountId: string,
  holdings: Holding[],
  securities: Security[]
): Promise<void> {
  if (holdings.length === 0) {
    return; // No holdings to upsert
  }

  const supabase = getSupabaseServiceRole();

  // Create security lookup map for fast access
  const securityMap = new Map(securities.map(s => [s.security_id, s]));

  // Transform holdings into database format (denormalized with security metadata)
  const holdingsToInsert: InvestmentHoldingInsert[] = holdings.map(holding => {
    const security = securityMap.get(holding.security_id);

    return {
      user_id: userId,
      account_id: accountId,
      security_id: holding.security_id,
      quantity: holding.quantity,
      institution_price: holding.institution_price,
      institution_price_as_of: holding.institution_price_as_of || null,
      institution_value: holding.institution_value,
      cost_basis: holding.cost_basis || null,
      ticker_symbol: security?.ticker_symbol || null,
      security_name: security?.name || null,
      security_type: security?.type || null,
      security_subtype: security?.subtype || null,
      close_price: security?.close_price || null,
      close_price_as_of: security?.close_price_as_of || null,
      iso_currency_code: holding.iso_currency_code || null,
      unofficial_currency_code: holding.unofficial_currency_code || null,
      last_synced_at: new Date().toISOString(),
    };
  });

  // Upsert holdings (update if exists, insert if new)
  const { error } = await supabase
    .from("investment_holdings")
    .upsert(holdingsToInsert, {
      onConflict: "account_id,security_id", // Unique constraint
      ignoreDuplicates: false, // Update existing rows
    });

  if (error) {
    throw new Error(`Failed to upsert investment holdings: ${error.message}`);
  }
}

/**
 * Get all investment holdings for a user across all accounts
 * Includes account metadata via join
 * @param userId - User ID
 * @returns Array of holdings with account information
 */
export async function getHoldingsByUserId(
  userId: string
): Promise<InvestmentHoldingWithAccount[]> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from("investment_holdings")
    .select(`
      *,
      accounts!inner(name, type, subtype)
    `)
    .eq("user_id", userId)
    .order("institution_value", { ascending: false }); // Sort by value (largest first)

  if (error) {
    throw new Error(`Failed to fetch investment holdings: ${error.message}`);
  }

  // Flatten nested account data
  return (data || []).map(row => ({
    ...row,
    account_name: (row.accounts as any)?.name,
    account_type: (row.accounts as any)?.type,
    account_subtype: (row.accounts as any)?.subtype,
  }));
}

/**
 * Get investment holdings for a specific account
 * @param userId - User ID
 * @param accountId - Plaid account_id
 * @returns Array of holdings for the account
 */
export async function getHoldingsByAccountId(
  userId: string,
  accountId: string
): Promise<InvestmentHoldingRow[]> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from("investment_holdings")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("institution_value", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch holdings for account: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete all holdings for an account (used when disconnecting)
 * @param accountId - Plaid account_id
 */
export async function deleteHoldingsByAccountId(accountId: string): Promise<void> {
  const supabase = getSupabaseServiceRole();

  const { error } = await supabase
    .from("investment_holdings")
    .delete()
    .eq("account_id", accountId);

  if (error) {
    throw new Error(`Failed to delete holdings for account: ${error.message}`);
  }
}

/**
 * Delete all holdings for a user (used in cleanup/testing)
 * @param userId - User ID
 */
export async function deleteHoldingsByUserId(userId: string): Promise<void> {
  const supabase = getSupabaseServiceRole();

  const { error } = await supabase
    .from("investment_holdings")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete holdings for user: ${error.message}`);
  }
}
