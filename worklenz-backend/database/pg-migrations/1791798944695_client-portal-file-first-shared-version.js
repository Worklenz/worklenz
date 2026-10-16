'use strict';
// Client Portal: sharing a file shares the version that was current when it was shared, and later ones.
// Earlier versions (internal drafts uploaded before the file was shared) stay Internal Only. This column
// records that first shared version; clients can open versions >= it. It is cleared when the file goes
// back to Internal Only, so sharing it again starts from the then-current version.
//
// Backfill: a file already shared by staff starts at its current version (drafts are hidden from now on).
// A file a client uploaded was always theirs to see, so it starts at version 1.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_files
      ADD COLUMN IF NOT EXISTS first_shared_version INTEGER;

    UPDATE project_files
       SET first_shared_version = CASE WHEN uploaded_by_side = 'client' THEN 1 ELSE COALESCE(current_version, 1) END
     WHERE portal_visibility = 'client' AND first_shared_version IS NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'project_files'::regclass AND conname = 'project_files_first_shared_version_check'
      ) THEN
        ALTER TABLE project_files
          ADD CONSTRAINT project_files_first_shared_version_check CHECK (first_shared_version IS NULL OR first_shared_version >= 1);
      END IF;
    END $$;

    COMMENT ON COLUMN project_files.first_shared_version IS
      'Client Portal: the first file version clients may open (set when the file is shared, cleared when it returns to Internal Only).';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_first_shared_version_check;
    ALTER TABLE project_files DROP COLUMN IF EXISTS first_shared_version;
  `);
};
