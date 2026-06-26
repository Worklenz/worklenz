'use strict';
// Converted from: database/migrations/20251211000000-create-client-portal-notification-reads.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: CREATE TABLE IF NOT EXISTS to track read status of client portal notifications
-- Date: 2025-12-11
-- Description: This table stores which notifications have been marked as read by clients
-- Since notifications are generated on-the-fly from various sources (requests, invoices, chat messages),
-- we need a separate table to track their read status

-- Create the notification reads tracking table
CREATE TABLE IF NOT EXISTS client_portal_notification_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL,
    organization_team_id UUID NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'request', 'invoice', 'message'
    reference_id UUID NOT NULL, -- The ID of the underlying entity (request_id, invoice_id, message_id)
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Composite unique constraint to prevent duplicate read entries
    UNIQUE(client_id, organization_team_id, notification_type, reference_id),

    -- Foreign key constraints
    CONSTRAINT fk_notification_reads_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notification_reads_organization
        FOREIGN KEY (organization_team_id)
        REFERENCES teams(id)
        ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_reads_client_org
    ON client_portal_notification_reads(client_id, organization_team_id);

CREATE INDEX IF NOT EXISTS idx_notification_reads_reference
    ON client_portal_notification_reads(notification_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_notification_reads_read_at
    ON client_portal_notification_reads(read_at);

-- Add comment to the table
COMMENT ON TABLE client_portal_notification_reads IS
    'Tracks which client portal notifications have been read by clients. Works with on-the-fly generated notifications from requests, invoices, and chat messages.';

COMMENT ON COLUMN client_portal_notification_reads.notification_type IS
    'Type of notification: request, invoice, or message';

COMMENT ON COLUMN client_portal_notification_reads.reference_id IS
    'ID of the underlying entity (request, invoice, or chat message)';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
