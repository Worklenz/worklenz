'use strict';
// Client Portal v2 discussions: a staff message can carry files. Each file is uploaded to the project
// first (presign + confirm), so an attachment row points at its project_files record, which is what
// staff download from. file_name, file_type and size stay as a snapshot so the row still reads
// correctly if the project file is later removed (file_id then becomes NULL).

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_thread_message_attachments (
        id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id UUID                     NOT NULL REFERENCES client_portal_thread_messages (id) ON DELETE CASCADE,
        file_id    UUID                     REFERENCES project_files (id) ON DELETE SET NULL,
        file_name  TEXT                     NOT NULL,
        file_type  TEXT                     NOT NULL DEFAULT '',
        size       BIGINT                   NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_thread_message_attachments_message
        ON client_portal_thread_message_attachments (message_id);

    -- A project file is attached to at most one message.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_thread_message_attachments_file
        ON client_portal_thread_message_attachments (file_id) WHERE file_id IS NOT NULL;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS client_portal_thread_message_attachments;`);
};
