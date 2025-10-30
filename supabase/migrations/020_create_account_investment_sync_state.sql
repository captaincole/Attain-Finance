-- Migration 020: Create account_investment_sync_state table
-- Purpose: Track investment holdings sync status per account
-- Similar to account_sync_state for transactions, but simpler (no cursor tracking)

CREATE TABLE account_investment_sync_state (
  account_id TEXT PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,

  -- Sync status tracking
  sync_status TEXT NOT NULL DEFAULT 'never_synced' CHECK (sync_status IN ('never_synced', 'syncing', 'synced', 'error')),
  last_synced_at TIMESTAMP,
  last_error TEXT,

  -- Metrics for observability
  holdings_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying sync status
CREATE INDEX idx_account_investment_sync_state_status ON account_investment_sync_state(sync_status);
CREATE INDEX idx_account_investment_sync_state_last_synced ON account_investment_sync_state(last_synced_at);

-- Comments for documentation
COMMENT ON TABLE account_investment_sync_state IS 'Tracks investment holdings sync status per account';
COMMENT ON COLUMN account_investment_sync_state.sync_status IS 'Current sync status: never_synced, syncing, synced, or error';
COMMENT ON COLUMN account_investment_sync_state.holdings_count IS 'Number of holdings in last successful sync';
