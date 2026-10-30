'use strict';
// Client portal thread message reactions: enables emoji reactions on discussion messages
// for both client contacts (via client portal) and staff users (via admin portal).

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_thread_message_reactions (
      id           UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
      message_id   UUID                     NOT NULL REFERENCES client_portal_thread_messages(id) ON DELETE CASCADE,
      reactor_side TEXT                     NOT NULL CHECK (reactor_side IN ('client', 'internal')),
      user_id      UUID                     REFERENCES users(id) ON DELETE CASCADE,
      contact_id   UUID                     REFERENCES client_contacts(id) ON DELETE CASCADE,
      reactor_name TEXT                     NOT NULL,
      emoji        VARCHAR(32)              NOT NULL,
      created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT client_portal_reactions_actor_check CHECK (
        (reactor_side = 'internal' AND user_id IS NOT NULL AND contact_id IS NULL) OR
        (reactor_side = 'client' AND contact_id IS NOT NULL AND user_id IS NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_reactions_contact_emoji
      ON client_portal_thread_message_reactions (message_id, contact_id, emoji)
      WHERE contact_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_reactions_user_emoji
      ON client_portal_thread_message_reactions (message_id, user_id, emoji)
      WHERE user_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_reactions_message
      ON client_portal_thread_message_reactions (message_id, created_at);

    COMMENT ON TABLE client_portal_thread_message_reactions IS
      'Emoji reactions on client portal discussion thread messages by client contacts and internal team members.';
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_thread_message_reactions;
  `);
};
