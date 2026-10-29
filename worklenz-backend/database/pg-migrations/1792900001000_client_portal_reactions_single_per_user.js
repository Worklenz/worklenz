'use strict';
// Enforce single reaction per user/contact on a discussion message.
// When a user reacts with another emoji, their previous reaction is replaced.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    -- Deduplicate any existing multi-reactions keeping the latest created_at
    DELETE FROM client_portal_thread_message_reactions r1
     USING client_portal_thread_message_reactions r2
     WHERE r1.id <> r2.id
       AND r1.message_id = r2.message_id
       AND r1.user_id IS NOT NULL
       AND r1.user_id = r2.user_id
       AND r1.created_at < r2.created_at;

    DELETE FROM client_portal_thread_message_reactions r1
     USING client_portal_thread_message_reactions r2
     WHERE r1.id <> r2.id
       AND r1.message_id = r2.message_id
       AND r1.contact_id IS NOT NULL
       AND r1.contact_id = r2.contact_id
       AND r1.created_at < r2.created_at;

    DROP INDEX IF EXISTS idx_client_portal_reactions_contact_emoji;
    DROP INDEX IF EXISTS idx_client_portal_reactions_user_emoji;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_reactions_contact_single
      ON client_portal_thread_message_reactions (message_id, contact_id)
      WHERE contact_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_reactions_user_single
      ON client_portal_thread_message_reactions (message_id, user_id)
      WHERE user_id IS NOT NULL;
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_client_portal_reactions_contact_single;
    DROP INDEX IF EXISTS idx_client_portal_reactions_user_single;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_reactions_contact_emoji
      ON client_portal_thread_message_reactions (message_id, contact_id, emoji)
      WHERE contact_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_reactions_user_emoji
      ON client_portal_thread_message_reactions (message_id, user_id, emoji)
      WHERE user_id IS NOT NULL;
  `);
};
