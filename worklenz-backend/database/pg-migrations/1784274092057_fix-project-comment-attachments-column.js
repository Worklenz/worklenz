/**
 * Fixes project_comment_attachments schema drift: the column was renamed
 * from `url` to `key` in 1784000000000_project-comment-attachments.js after
 * that migration had already run on some environments (e.g. UAT), so the
 * edit had no effect there — this migration performs the rename directly.
 *
 * Guarded with an existence check because 1_tables.sql was fixed at the same
 * time to create the column as `key` directly — a fresh database bootstrapped
 * from that file (with no `url` column ever existing) must not error out here.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project_comment_attachments' AND column_name = 'url'
      ) THEN
        ALTER TABLE project_comment_attachments RENAME COLUMN url TO key;
      END IF;
    END $$;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project_comment_attachments' AND column_name = 'key'
      ) THEN
        ALTER TABLE project_comment_attachments RENAME COLUMN key TO url;
      END IF;
    END $$;
  `);
};
