-- Migration: Add Admin Comments Viewed Tracking
-- Description: Adds tracking for when admin views comments on a request to show new comments count
-- Date: 2025-01-XX
-- Version: 2.3.1

-- Add column to track when admin last viewed comments for a request
ALTER TABLE client_portal_requests 
ADD COLUMN IF NOT EXISTS admin_comments_viewed_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_requests_admin_comments_viewed_at 
ON client_portal_requests(admin_comments_viewed_at);

-- Add comment for documentation
COMMENT ON COLUMN client_portal_requests.admin_comments_viewed_at IS 'Timestamp when admin last viewed comments for this request. Used to determine new/unread comments count.';

