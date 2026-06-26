'use strict';
// Converted from: database/migrations/release-v2.2.0/20250101000007-create-message-reads-table.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- CREATE TABLE IF NOT EXISTS for tracking message read status
CREATE TABLE IF NOT EXISTS client_portal_message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES client_portal_chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_message_reads_message_id ON client_portal_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_message_reads_user_id ON client_portal_message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_message_reads_read_at ON client_portal_message_reads(read_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON client_portal_message_reads TO worklenz_user;
GRANT SELECT ON client_portal_message_reads TO worklenz_client;

-- Add comments
COMMENT ON TABLE client_portal_message_reads IS 'Tracks when users read chat messages';
COMMENT ON COLUMN client_portal_message_reads.message_id IS 'Reference to the chat message';
COMMENT ON COLUMN client_portal_message_reads.user_id IS 'User who read the message';
COMMENT ON COLUMN client_portal_message_reads.read_at IS 'Timestamp when message was read';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
