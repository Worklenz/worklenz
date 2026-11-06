'use strict';

// Project deletes fail with:
//   null value in column "project_id" of relation "project_logs" violates not-null constraint
// Migration 1757289600000_preserve_project_logs_after_deletion changed the
// project_logs.project_id FK to ON DELETE SET NULL so a project's history is kept
// after it is deleted (LogsController already reports NULL project_id rows as
// deleted projects), but it never dropped the NOT NULL on the column. Since
// projects-controller logs the deletion into project_logs right before deleting
// the project, every delete trips the SET NULL and is rejected.
// Drop the NOT NULL so the FK action can run as intended.

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_logs
      ALTER COLUMN project_id DROP NOT NULL;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Restoring NOT NULL would fail once logs of deleted projects exist, and
  // deleting that history is not an acceptable rollback, so only restore it
  // when no such rows exist yet.
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM project_logs WHERE project_id IS NULL) THEN
        RAISE NOTICE 'project_logs has rows for deleted projects; keeping project_id nullable';
      ELSE
        ALTER TABLE project_logs
          ALTER COLUMN project_id SET NOT NULL;
      END IF;
    END
    $$;
  `);
};
