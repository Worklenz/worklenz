'use strict';
// Client Portal v2 discussions: a message body can now be rich text (sanitized HTML), so the length
// check has to leave room for the markup. The visible text is still limited to 5000 characters by
// the service; this constraint is only the storage ceiling.

const BODY_CHECK = 'client_portal_thread_messages_body_check';

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_thread_messages DROP CONSTRAINT IF EXISTS ${BODY_CHECK};
    ALTER TABLE client_portal_thread_messages
        ADD CONSTRAINT ${BODY_CHECK} CHECK (char_length(body) BETWEEN 1 AND 30000);
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Rows longer than the old ceiling would block this; they are rich-text messages that cannot fit.
  pgm.sql(`
    ALTER TABLE client_portal_thread_messages DROP CONSTRAINT IF EXISTS ${BODY_CHECK};
    ALTER TABLE client_portal_thread_messages
        ADD CONSTRAINT ${BODY_CHECK} CHECK (char_length(body) BETWEEN 1 AND 5000);
  `);
};
