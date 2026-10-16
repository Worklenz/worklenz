'use strict';
// Discussions: a third message visibility, `client_only`. A client Member or Client Admin can reply to
// the other client users on the project without the team seeing it. It is never returned by a staff
// API and never notifies staff.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_thread_messages
      DROP CONSTRAINT IF EXISTS client_portal_thread_messages_visibility_check,
      DROP CONSTRAINT IF EXISTS client_portal_thread_messages_mention_check,
      DROP CONSTRAINT IF EXISTS client_portal_thread_messages_client_author_check;

    ALTER TABLE client_portal_thread_messages
      ADD CONSTRAINT client_portal_thread_messages_visibility_check
        CHECK (visibility IN ('client', 'internal', 'client_only')),
      -- A client-user mention exists only on a message client users can read.
      ADD CONSTRAINT client_portal_thread_messages_mention_check
        CHECK (visibility IN ('client', 'client_only') OR cardinality(mentioned_contact_ids) = 0),
      -- A client user can only write messages that client users can read, and only they write client_only.
      ADD CONSTRAINT client_portal_thread_messages_client_author_check
        CHECK (
          (author_side = 'internal' AND visibility IN ('client', 'internal'))
          OR (author_side = 'client' AND visibility IN ('client', 'client_only'))
        );
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DELETE FROM client_portal_thread_messages WHERE visibility = 'client_only';

    ALTER TABLE client_portal_thread_messages
      DROP CONSTRAINT IF EXISTS client_portal_thread_messages_visibility_check,
      DROP CONSTRAINT IF EXISTS client_portal_thread_messages_mention_check,
      DROP CONSTRAINT IF EXISTS client_portal_thread_messages_client_author_check;

    ALTER TABLE client_portal_thread_messages
      ADD CONSTRAINT client_portal_thread_messages_visibility_check CHECK (visibility IN ('client', 'internal')),
      ADD CONSTRAINT client_portal_thread_messages_mention_check
        CHECK (visibility = 'client' OR cardinality(mentioned_contact_ids) = 0),
      ADD CONSTRAINT client_portal_thread_messages_client_author_check
        CHECK (author_side = 'internal' OR visibility = 'client');
  `);
};
