import { SupabaseClient } from "@supabase/supabase-js";

export type SyncStatus = "pending" | "syncing" | "complete" | "error";

export interface AccountSyncState {
  account_id: string;
  transaction_cursor: string | null;
  last_synced_at: string | null;
  sync_status: SyncStatus;
  error_message: string | null;
  total_transactions_synced: number;
  created_at: string;
  updated_at: string;
}

export class AccountSyncStateRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create initial sync state record for an account
   */
  async createSyncState(accountId: string): Promise<void> {
    const { error } = await this.supabase.from("account_sync_state").insert({
      account_id: accountId,
      sync_status: "pending",
      transaction_cursor: null,
      total_transactions_synced: 0,
    });

    if (error) {
      throw new Error(
        `Failed to create sync state for account ${accountId}: ${error.message}`
      );
    }
  }

  /**
   * Update sync progress during pagination
   */
  async updateSyncProgress(
    accountId: string,
    cursor: string,
    status: SyncStatus,
    additionalTxCount: number
  ): Promise<void> {
    // First get current count
    const { data: currentState, error: fetchError } = await this.supabase
      .from("account_sync_state")
      .select("total_transactions_synced")
      .eq("account_id", accountId)
      .single();

    if (fetchError) {
      throw new Error(
        `Failed to fetch sync state for account ${accountId}: ${fetchError.message}`
      );
    }

    const newCount = (currentState?.total_transactions_synced || 0) + additionalTxCount;

    // Update with new count
    const { error } = await this.supabase
      .from("account_sync_state")
      .update({
        transaction_cursor: cursor,
        sync_status: status,
        total_transactions_synced: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);

    if (error) {
      throw new Error(
        `Failed to update sync progress for account ${accountId}: ${error.message}`
      );
    }
  }

  /**
   * Mark sync as complete
   */
  async markSyncComplete(accountId: string, finalCursor: string): Promise<void> {
    const { error } = await this.supabase
      .from("account_sync_state")
      .update({
        sync_status: "complete",
        transaction_cursor: finalCursor,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null, // Clear any previous errors
      })
      .eq("account_id", accountId);

    if (error) {
      throw new Error(
        `Failed to mark sync complete for account ${accountId}: ${error.message}`
      );
    }
  }

  /**
   * Mark sync as failed with error details
   */
  async markSyncError(accountId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from("account_sync_state")
      .update({
        sync_status: "error",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);

    if (error) {
      throw new Error(
        `Failed to mark sync error for account ${accountId}: ${error.message}`
      );
    }
  }

  /**
   * Get sync state for an account
   */
  async getSyncState(accountId: string): Promise<AccountSyncState | null> {
    const { data, error } = await this.supabase
      .from("account_sync_state")
      .select("*")
      .eq("account_id", accountId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      throw new Error(
        `Failed to get sync state for account ${accountId}: ${error.message}`
      );
    }

    return data as AccountSyncState;
  }

  /**
   * Get all sync states for a user's accounts
   */
  async getSyncStatesByUserId(userId: string): Promise<AccountSyncState[]> {
    const { data, error } = await this.supabase
      .from("account_sync_state")
      .select(
        `
        *,
        accounts!inner(user_id)
      `
      )
      .eq("accounts.user_id", userId);

    if (error) {
      throw new Error(
        `Failed to get sync states for user ${userId}: ${error.message}`
      );
    }

    return data as AccountSyncState[];
  }
}
