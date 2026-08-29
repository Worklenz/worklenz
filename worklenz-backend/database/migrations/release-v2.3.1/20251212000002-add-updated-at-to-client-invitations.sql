-- Add updated_at column to client_invitations table
-- This column is needed for tracking when invitations are resent

ALTER TABLE client_invitations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows to have updated_at equal to created_at
UPDATE client_invitations 
SET updated_at = created_at 
WHERE updated_at IS NULL;
