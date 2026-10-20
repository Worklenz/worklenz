'use strict';
// Client Portal v2 discussions: an internal comment can mention project members (staff). They are
// stored as user ids beside the client-user mentions, and only an internal comment can carry them,
// so a staff name never appears on anything a client can read.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_thread_messages
        ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] NOT NULL DEFAULT '{}';

    ALTER TABLE client_portal_thread_messages
        DROP CONSTRAINT IF EXISTS client_portal_thread_messages_staff_mention_check;
    ALTER TABLE client_portal_thread_messages
        ADD CONSTRAINT client_portal_thread_messages_staff_mention_check
        CHECK (visibility = 'internal' OR cardinality(mentioned_user_ids) = 0);
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_thread_messages
        DROP CONSTRAINT IF EXISTS client_portal_thread_messages_staff_mention_check;
    ALTER TABLE client_portal_thread_messages DROP COLUMN IF EXISTS mentioned_user_ids;
  `);
};
