-- Migration 012: Add processing status to budgets
-- Tracks whether budget transaction labeling is in progress

ALTER TABLE budgets ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'ready';

-- Add constraint to ensure valid status values
ALTER TABLE budgets
  ADD CONSTRAINT budgets_processing_status_check
  CHECK (processing_status IN ('processing', 'ready', 'error'));

-- Add column to track when processing completed
ALTER TABLE budgets ADD COLUMN processing_completed_at TIMESTAMP WITH TIME ZONE;

-- Add column to track error message if processing failed
ALTER TABLE budgets ADD COLUMN processing_error TEXT;

-- Index for querying budgets by processing status
CREATE INDEX idx_budgets_processing_status ON budgets(processing_status) WHERE processing_status != 'ready';

-- Add comments for documentation
COMMENT ON COLUMN budgets.processing_status IS 'Status of background transaction labeling: processing (in progress), ready (complete), error (failed)';
COMMENT ON COLUMN budgets.processing_completed_at IS 'Timestamp when transaction labeling completed successfully';
COMMENT ON COLUMN budgets.processing_error IS 'Error message if processing_status is error';

-- Note: Deletion protection is enforced at the application layer (src/storage/budgets/budgets.ts)
-- Budgets with processing_status='processing' cannot be deleted until processing completes
