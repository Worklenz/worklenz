'use strict';
// Client Portal v2 change requests: a client attaches files to a request. The files are uploaded to
// the project first (presign + confirm), so each attachment row points at its project_files record,
// which is what staff download from. file_name, storage_key and size stay as a snapshot so the row
// still reads correctly if the project file is later removed (file_id then becomes NULL).

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_change_request_attachments
        ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES project_files (id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_change_request_attachments_file
        ON client_portal_change_request_attachments (file_id) WHERE file_id IS NOT NULL;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_client_portal_change_request_attachments_file;
    ALTER TABLE client_portal_change_request_attachments DROP COLUMN IF EXISTS file_id;
  `);
};
