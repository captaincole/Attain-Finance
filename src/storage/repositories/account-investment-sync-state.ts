/**
 * Account Investment Sync State Repository
 * Manages sync state tracking for investment holdings per account
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";

type SyncStatus = "never_synced" | "syncing" | "synced" | "error";

export interface AccountInvestmentSyncState {
  accountId: string;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  lastError: string | null;
  holdingsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class AccountInvestmentSyncStateRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create sync state record for an account
   * Idempotent - safe to call multiple times
   */
  async createSyncState(accountId: string): Promise<void> {
    const { error } = await this.supabase
      .from("account_investment_sync_state")
      .upsert(
        {
          account_id: accountId,
          sync_status: "never_synced",
          holdings_count: 0,
        },
        { onConflict: "account_id", ignoreDuplicates: true }
      );

    if (error) {
      throw new Error(
        `Failed to create investment sync state: ${error.message}`
      );
    }
  }

  /**
   * Get sync state for an account
   */
  async getSyncState(
    accountId: string
  ): Promise<AccountInvestmentSyncState | null> {
    const { data, error } = await this.supabase
      .from("account_investment_sync_state")
      .select("*")
      .eq("account_id", accountId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return null;
      }
      throw new Error(
        `Failed to get investment sync state: ${error.message}`
      );
    }

    return {
      accountId: data.account_id,
      syncStatus: data.sync_status as SyncStatus,
      lastSyncedAt: data.last_synced_at ? new Date(data.last_synced_at) : null,
      lastError: data.last_error,
      holdingsCount: data.holdings_count,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Mark sync as in progress
   */
  async markSyncInProgress(accountId: string): Promise<void> {
    const { error } = await this.supabase
      .from("account_investment_sync_state")
      .update({
        sync_status: "syncing",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);

    if (error) {
      throw new Error(
        `Failed to mark investment sync in progress: ${error.message}`
      );
    }
  }

  /**
   * Mark sync as complete with holdings count
   */
  async markSyncComplete(
    accountId: string,
    holdingsCount: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from("account_investment_sync_state")
      .update({
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        last_error: null,
        holdings_count: holdingsCount,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);

    if (error) {
      throw new Error(
        `Failed to mark investment sync complete: ${error.message}`
      );
    }
  }

  /**
   * Mark sync as error
   */
  async markSyncError(accountId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from("account_investment_sync_state")
      .update({
        sync_status: "error",
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);

    if (error) {
      throw new Error(
        `Failed to mark investment sync error: ${error.message}`
      );
    }
  }
}
