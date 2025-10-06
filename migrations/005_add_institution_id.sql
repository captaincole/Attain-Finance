-- Migration: DEPRECATED - No need to store institution details
-- The institution_name is already returned by Plaid's accountsGet() API
-- We don't need to store it separately in our database

-- No changes needed - institution info comes from Plaid API response
