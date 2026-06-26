'use strict';
// Converted from: database/migrations/release-v2.3.1/20251212000001-add-client-portal-notifications-read.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add client_portal_notifications table
-- Description: Centralized notifications table for client portal
-- Date: 2025-12-12

-- Create centralized notifications table for client portal
CREATE TABLE IF NOT EXISTS client_portal_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Notification type: 'request_update', 'invoice_created', 'new_message', 'project_update'
    type VARCHAR(50) NOT NULL,
    
    -- Reference to the source entity (request, invoice, message, project)
    reference_id UUID,
    reference_number VARCHAR(100),
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT,
    
    -- Metadata stored as JSON for flexibility
    metadata JSONB DEFAULT '{}',
    
    -- Status tracking
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_cp_notifications_client_id 
    ON client_portal_notifications(client_id);

CREATE INDEX IF NOT EXISTS idx_cp_notifications_org_team 
    ON client_portal_notifications(organization_team_id);

CREATE INDEX IF NOT EXISTS idx_cp_notifications_type 
    ON client_portal_notifications(type);

CREATE INDEX IF NOT EXISTS idx_cp_notifications_is_read 
    ON client_portal_notifications(client_id, is_read);

CREATE INDEX IF NOT EXISTS idx_cp_notifications_created_at 
    ON client_portal_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cp_notifications_reference 
    ON client_portal_notifications(type, reference_id);

-- Add comment to table
COMMENT ON TABLE client_portal_notifications IS 'Centralized notifications table for client portal users';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
