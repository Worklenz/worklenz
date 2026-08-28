-- Add assigned_to field to client_portal_requests table
-- This allows team members to be assigned to handle specific requests

ALTER TABLE client_portal_requests 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_requests_assigned_to ON client_portal_requests(assigned_to);

-- Add comments for clarity
COMMENT ON COLUMN client_portal_requests.assigned_to IS 'The user (team member) assigned to handle this request';