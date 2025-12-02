-- Add progress_message column to claims table for real-time UI updates
ALTER TABLE claims ADD COLUMN IF NOT EXISTS progress_message TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN claims.progress_message IS 'Temporary message shown in UI during tool execution (e.g., "Finding nearest tow truck...")';

