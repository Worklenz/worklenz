-- Migration: Fix Client Portal Request Unique Constraint
-- Description: Changes req_no constraint from globally unique to unique per service
-- Date: 2026-01-05
-- Issue: Request numbers should be unique per service, not globally

-- Drop the existing unique constraint on req_no
ALTER TABLE client_portal_requests 
DROP CONSTRAINT IF EXISTS client_portal_requests_req_no_key;

-- Add composite unique constraint on (service_id, req_no)
-- This allows each service to have their own sequence (REQ-0001, REQ-0002, etc.)
ALTER TABLE client_portal_requests
ADD CONSTRAINT client_portal_requests_service_req_no_unique 
UNIQUE (service_id, req_no);

-- Add index for performance on the composite key
CREATE INDEX IF NOT EXISTS idx_client_portal_requests_service_req_no 
ON client_portal_requests(service_id, req_no);

