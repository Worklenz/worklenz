'use strict';
// Converted from: database/migrations/release-v2.3.1/20251202000000-add-request-status-history.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add request status history table for tracking status changes
-- Date: 2025-12-02

-- Create the status history table
CREATE TABLE IF NOT EXISTS client_portal_request_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES client_portal_requests(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_client UUID REFERENCES client_users(id) ON DELETE SET NULL,
    notes TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_request_status_history_request_id ON client_portal_request_status_history(request_id);
CREATE INDEX IF NOT EXISTS idx_request_status_history_changed_at ON client_portal_request_status_history(changed_at);

-- Add timestamp columns to client_portal_requests for quick access to key status dates
ALTER TABLE client_portal_requests 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- Create a function to automatically log status changes
CREATE OR REPLACE FUNCTION log_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO client_portal_request_status_history (
            request_id,
            previous_status,
            new_status,
            changed_at
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            CURRENT_TIMESTAMP
        );
        
        -- Update the specific status timestamp columns
        IF NEW.status = 'accepted' THEN
            NEW.accepted_at = CURRENT_TIMESTAMP;
        ELSIF NEW.status = 'in_progress' THEN
            NEW.in_progress_at = CURRENT_TIMESTAMP;
        ELSIF NEW.status = 'rejected' THEN
            NEW.rejected_at = CURRENT_TIMESTAMP;
        ELSIF NEW.status = 'completed' THEN
            NEW.completed_at = CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log status changes
DROP TRIGGER IF EXISTS trigger_log_request_status_change ON client_portal_requests;
CREATE TRIGGER trigger_log_request_status_change
    BEFORE UPDATE ON client_portal_requests
    FOR EACH ROW
    EXECUTE FUNCTION log_request_status_change();

-- Insert initial status history for existing requests (created status)
INSERT INTO client_portal_request_status_history (request_id, previous_status, new_status, changed_at)
SELECT id, NULL, 'pending', created_at
FROM client_portal_requests
WHERE NOT EXISTS (
    SELECT 1 FROM client_portal_request_status_history h WHERE h.request_id = client_portal_requests.id
);

-- Add comment for documentation
COMMENT ON TABLE client_portal_request_status_history IS 'Tracks all status changes for client portal requests with timestamps';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
