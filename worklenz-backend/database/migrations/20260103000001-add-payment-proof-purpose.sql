-- Migration: Add payment_proof to client_portal_attachments purpose constraint
-- Description: Adds 'payment_proof' as a valid purpose for client portal attachments
-- Date: 2026-01-03
-- Version: 2.3.2

-- Drop the existing CHECK constraint
ALTER TABLE client_portal_attachments
DROP CONSTRAINT IF EXISTS client_portal_attachments_purpose_check;

-- Add the new CHECK constraint with payment_proof included
ALTER TABLE client_portal_attachments
ADD CONSTRAINT client_portal_attachments_purpose_check 
CHECK (purpose IN ('request', 'chat', 'avatar', 'document', 'payment_proof', 'general'));

-- Update the comment to reflect the new purpose
COMMENT ON COLUMN client_portal_attachments.purpose IS 'Categorizes the attachment: request (request attachments), chat (chat files), avatar (profile pictures), document (general documents), payment_proof (payment proof images/files), general (uncategorized)';

