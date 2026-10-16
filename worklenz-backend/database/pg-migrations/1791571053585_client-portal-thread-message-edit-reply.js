'use strict';
// Discussions: a sender can edit or delete their own message, and anyone can reply to a message.
// A deleted message stays as a tombstone (deleted_at) so replies keep their quoted parent.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_thread_messages
      ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES client_portal_thread_messages(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_client_portal_thread_messages_parent
      ON client_portal_thread_messages (parent_message_id)
      WHERE parent_message_id IS NOT NULL;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_client_portal_thread_messages_parent;

    ALTER TABLE client_portal_thread_messages
      DROP COLUMN IF EXISTS deleted_at,
      DROP COLUMN IF EXISTS edited_at,
      DROP COLUMN IF EXISTS parent_message_id;
  `);
};
