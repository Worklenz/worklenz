'use strict';
// Personal task pinning on Home > Today's Priorities (#2372).
// One row per (user, task): a pin is private to the user who made it. The pin cap (25) and the
// visibility rules are enforced by the API (POST /home/pinned-tasks/:taskId), not here, because
// "visible" depends on team scope, assignee scope and archived projects.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_pinned_tasks (
        id        UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id   UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        pinned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT user_pinned_tasks_user_task_key UNIQUE (user_id, task_id)
    );

    -- "Most recently pinned first" for one user.
    CREATE INDEX IF NOT EXISTS idx_user_pinned_tasks_user_pinned_at
        ON user_pinned_tasks(user_id, pinned_at DESC);

    -- Lets the ON DELETE CASCADE from tasks find a task's pins without scanning the table.
    CREATE INDEX IF NOT EXISTS idx_user_pinned_tasks_task_id
        ON user_pinned_tasks(task_id);
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS user_pinned_tasks;`);
};
