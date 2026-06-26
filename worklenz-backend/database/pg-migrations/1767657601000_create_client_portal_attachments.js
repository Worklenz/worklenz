'use strict';
// Converted from: database/migrations/release-v2.3.1/20250101000008-create-client-portal-attachments.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Create Client Portal Attachments Table
-- Description: Creates a dedicated table for tracking client portal file attachments with S3 storage
-- Date: 2025-12-02
-- Version: 2.2.0

-- Client Portal Attachments Table
-- Tracks all file uploads in the client portal with proper lifecycle management
CREATE TABLE IF NOT EXISTS client_portal_attachments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    request_id UUID REFERENCES client_portal_requests(id) ON DELETE SET NULL,
    
    -- File metadata
    original_name TEXT NOT NULL,
    storage_key TEXT NOT NULL,  -- Full S3/Azure key for file operations
    file_url TEXT NOT NULL,     -- Public URL for file access
    file_type TEXT NOT NULL,    -- MIME type
    file_extension TEXT,        -- File extension without dot
    file_size BIGINT NOT NULL,  -- Size in bytes
    
    -- Purpose categorization
    purpose TEXT NOT NULL DEFAULT 'general' CHECK (purpose IN ('request', 'chat', 'avatar', 'document', 'general')),
    
    -- Audit fields
    uploaded_by_client_id UUID REFERENCES clients(id),
    uploaded_by_user_id UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE  -- Soft delete for cleanup jobs
);

-- Add comments for documentation
COMMENT ON TABLE client_portal_attachments IS 'Tracks all file uploads in the client portal with S3/Azure storage references';
COMMENT ON COLUMN client_portal_attachments.storage_key IS 'Full storage key path for S3/Azure operations (e.g., prod/client-portal/request-attachments/org-id/request-id/filename)';
COMMENT ON COLUMN client_portal_attachments.file_url IS 'Public URL for accessing the file';
COMMENT ON COLUMN client_portal_attachments.purpose IS 'Categorizes the attachment: request (request attachments), chat (chat files), avatar (profile pictures), document (general documents), general (uncategorized)';
COMMENT ON COLUMN client_portal_attachments.deleted_at IS 'Soft delete timestamp - files marked for cleanup by background job';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cp_attachments_org_team_id ON client_portal_attachments(organization_team_id);
CREATE INDEX IF NOT EXISTS idx_cp_attachments_client_id ON client_portal_attachments(client_id);
CREATE INDEX IF NOT EXISTS idx_cp_attachments_request_id ON client_portal_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_cp_attachments_purpose ON client_portal_attachments(purpose);
CREATE INDEX IF NOT EXISTS idx_cp_attachments_created_at ON client_portal_attachments(created_at);
CREATE INDEX IF NOT EXISTS idx_cp_attachments_deleted_at ON client_portal_attachments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_portal_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cp_attachments_updated_at ON client_portal_attachments;
CREATE TRIGGER trigger_update_cp_attachments_updated_at
    BEFORE UPDATE ON client_portal_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_client_portal_attachments_updated_at();

-- Function to soft delete attachments when a request is deleted
-- This allows the cleanup job to remove files from S3 later
CREATE OR REPLACE FUNCTION soft_delete_request_attachments()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE client_portal_attachments
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE request_id = OLD.id AND deleted_at IS NULL;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to soft delete attachments when request is deleted
DROP TRIGGER IF EXISTS trigger_soft_delete_request_attachments ON client_portal_requests;
CREATE TRIGGER trigger_soft_delete_request_attachments
    BEFORE DELETE ON client_portal_requests
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete_request_attachments();

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
