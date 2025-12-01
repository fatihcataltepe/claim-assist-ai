-- Remove notification_sent from claim_status enum
-- First, update any existing claims with notification_sent status to completed
UPDATE claims 
SET status = 'completed' 
WHERE status = 'notification_sent';

-- Drop the default temporarily
ALTER TABLE claims ALTER COLUMN status DROP DEFAULT;

-- Drop the old enum and create a new one without notification_sent
ALTER TYPE claim_status RENAME TO claim_status_old;

CREATE TYPE claim_status AS ENUM (
  'data_gathering',
  'coverage_check',
  'arranging_services',
  'completed'
);

-- Update the claims table to use the new enum
ALTER TABLE claims 
  ALTER COLUMN status TYPE claim_status 
  USING status::text::claim_status;

-- Drop the old enum
DROP TYPE claim_status_old;

-- Re-add the default
ALTER TABLE claims ALTER COLUMN status SET DEFAULT 'data_gathering'::claim_status;