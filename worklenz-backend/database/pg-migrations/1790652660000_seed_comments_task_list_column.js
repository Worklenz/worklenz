'use strict';
// Backfills the "Latest Comment" task-list column for existing projects and
// keeps new projects in sync by refreshing insert_task_list_columns().
// Runs after the enum value is committed (see previous migration).

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned, custom_column)
    SELECT p.id, 'Comments', 'COMMENTS', 19, FALSE, FALSE
    FROM projects p
    WHERE NOT EXISTS (
      SELECT 1
      FROM project_task_list_cols c
      WHERE c.project_id = p.id
        AND c.key = 'COMMENTS'
    );

    CREATE OR REPLACE FUNCTION insert_task_list_columns(_project_id uuid) RETURNS void
      LANGUAGE plpgsql
    AS
    $$
    DECLARE
    BEGIN
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Key', 'KEY', 0, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Description', 'DESCRIPTION', 2, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Progress', 'PROGRESS', 3, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Status', 'STATUS', 4, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Members', 'ASSIGNEES', 5, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Labels', 'LABELS', 6, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Phase', 'PHASE', 7, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Priority', 'PRIORITY', 8, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Time Tracking', 'TIME_TRACKING', 9, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Estimation', 'ESTIMATION', 10, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Start Date', 'START_DATE', 11, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Due Date', 'DUE_DATE', 12, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Due Time', 'DUE_TIME', 13, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Completed Date', 'COMPLETED_DATE', 14, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Created Date', 'CREATED_DATE', 15, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Last Updated', 'LAST_UPDATED', 16, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Reporter', 'REPORTER', 17, FALSE);
      -- Keep the Attachments column when the enum supports it (added by the
      -- attachment-column branch) so recreating this function never drops it.
      IF EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE LOWER(t.typname) = 'wl_task_list_col_key'
          AND e.enumlabel = 'ATTACHMENTS'
      ) THEN
        INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
        VALUES (_project_id, 'Attachments', 'ATTACHMENTS', 18, FALSE);
      END IF;
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
      VALUES (_project_id, 'Comments', 'COMMENTS', 19, FALSE);
    END
    $$;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async () => {
  // Backfilled column rows are harmless to leave in place.
};
