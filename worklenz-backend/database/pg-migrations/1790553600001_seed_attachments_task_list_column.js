exports.up = async function (pgm) {
  pgm.sql(`
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned, custom_column)
    SELECT p.id, 'Attachments', 'ATTACHMENTS',
           COALESCE((SELECT MAX(index) + 1
                     FROM project_task_list_cols
                     WHERE project_id = p.id), 0),
           FALSE, FALSE
    FROM projects p
    WHERE NOT EXISTS (
      SELECT 1
      FROM project_task_list_cols c
      WHERE c.project_id = p.id
        AND c.key = 'ATTACHMENTS'
    );

    CREATE OR REPLACE FUNCTION insert_task_list_columns(_project_id uuid) RETURNS void
      LANGUAGE plpgsql
    AS
    $$
    BEGIN
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Key', 'KEY', 0, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Description', 'DESCRIPTION', 2, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Progress', 'PROGRESS', 3, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Status', 'STATUS', 4, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Members', 'ASSIGNEES', 5, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Labels', 'LABELS', 6, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Phase', 'PHASE', 7, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Priority', 'PRIORITY', 8, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Time Tracking', 'TIME_TRACKING', 9, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Estimation', 'ESTIMATION', 10, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Start Date', 'START_DATE', 11, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Due Date', 'DUE_DATE', 12, TRUE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Due Time', 'DUE_TIME', 13, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Completed Date', 'COMPLETED_DATE', 14, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Created Date', 'CREATED_DATE', 15, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Last Updated', 'LAST_UPDATED', 16, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Reporter', 'REPORTER', 17, FALSE);
      INSERT INTO project_task_list_cols (project_id, name, key, index, pinned) VALUES (_project_id, 'Attachments', 'ATTACHMENTS', 18, FALSE);
    END
    $$;
  `);
};

exports.down = async function () {
  // PostgreSQL enum values cannot be removed safely after they are committed.
};
