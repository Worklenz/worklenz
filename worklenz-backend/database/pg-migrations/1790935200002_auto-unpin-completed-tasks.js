'use strict';
// Completing a task removes it from everyone's pinned list (#2372). Done tasks never appear in the
// Home task list anyway, so this only keeps user_pinned_tasks from collecting dead rows, and it
// means a task that is reopened later does not come back pinned.
//
// Done at the trigger level so every path that changes a task's status is covered: the socket
// handler, update_task_status(), bulk_change_tasks_status(), phase auto-advance and recurring
// tasks - none of them need to know about pins.
//
// NOTE: creating a function needs the schema/function owner. If the application DB role is
// restricted, run this with the MIGRATION_DB_* credentials (see scripts/migrate.js).

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION unpin_completed_task_fn() RETURNS TRIGGER AS
    $$
    BEGIN
        IF is_completed(NEW.status_id, NEW.project_id) THEN
            DELETE FROM user_pinned_tasks WHERE task_id = NEW.id;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS tasks_unpin_when_completed ON tasks;

    CREATE TRIGGER tasks_unpin_when_completed
        AFTER UPDATE OF status_id ON tasks
        FOR EACH ROW
        WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
        EXECUTE FUNCTION unpin_completed_task_fn();
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS tasks_unpin_when_completed ON tasks;
    DROP FUNCTION IF EXISTS unpin_completed_task_fn();
  `);
};
