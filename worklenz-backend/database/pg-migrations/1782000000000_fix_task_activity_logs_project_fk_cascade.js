// Production deletes of projects fail with:
//   foreign_key_violation on "task_activity_logs_projects_id_fk"
// because projects-controller logs the deletion into task_activity_logs
// immediately before deleting the project. The schema (1_tables.sql) declares
// this FK as ON DELETE CASCADE, but older databases have it without cascade.
// Re-create the constraint with ON DELETE CASCADE so the log rows are removed
// together with the project.
exports.up = async (db) => {
  await db.query(`
    ALTER TABLE task_activity_logs
        DROP CONSTRAINT IF EXISTS task_activity_logs_projects_id_fk;

    ALTER TABLE task_activity_logs
        ADD CONSTRAINT task_activity_logs_projects_id_fk
            FOREIGN KEY (project_id) REFERENCES projects (id)
                ON DELETE CASCADE;
  `);
};

exports.down = async (db) => {
  await db.query(`
    ALTER TABLE task_activity_logs
        DROP CONSTRAINT IF EXISTS task_activity_logs_projects_id_fk;

    ALTER TABLE task_activity_logs
        ADD CONSTRAINT task_activity_logs_projects_id_fk
            FOREIGN KEY (project_id) REFERENCES projects (id);
  `);
};
