-- Migration 014: Add unique constraint on account_id
-- Plaid's account_id is globally unique, so we can safely add this constraint
-- This allows account_sync_state to reference account_id directly

ALTER TABLE accounts ADD CONSTRAINT accounts_account_id_key UNIQUE (account_id);
