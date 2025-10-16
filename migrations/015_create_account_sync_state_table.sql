-- Migration 015: Create account_sync_state table for transaction sync observability
-- This table tracks the sync state of each account's transactions using Plaid's /transactions/sync endpoint
-- Each account maintains its own cursor for independent sync streams and error isolation

CREATE TABLE account_sync_state (
  account_id TEXT PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
  transaction_cursor TEXT, -- Plaid cursor for incremental sync (up to 256 chars base64)
  last_synced_at TIMESTAMPTZ, -- When the last successful sync completed
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending', 'syncing', 'complete', 'error')) DEFAULT 'pending',
  error_message TEXT, -- Error details if sync_status = 'error'
  total_transactions_synced INTEGER DEFAULT 0, -- Running count of transactions synced for this account
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying accounts by sync status (e.g., finding failed syncs)
CREATE INDEX idx_account_sync_state_status ON account_sync_state(sync_status);

-- Index for querying by last sync time (e.g., finding stale accounts)
CREATE INDEX idx_account_sync_state_last_synced ON account_sync_state(last_synced_at);
