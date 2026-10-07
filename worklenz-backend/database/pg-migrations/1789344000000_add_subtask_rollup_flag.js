// Project-level toggle: when enabled, a parent task (one that has subtasks) shows
// the rolled-up sum/aggregate of its subtasks for estimated time, logged time and
// completion, and those fields become read-only on the parent.

exports.up = async function (pgm) {
    pgm.sql(`
        ALTER TABLE projects
            ADD COLUMN IF NOT EXISTS use_subtask_rollup BOOLEAN DEFAULT FALSE;
    `);
};

exports.down = async function (pgm) {
    pgm.sql(`
        ALTER TABLE projects
            DROP COLUMN IF EXISTS use_subtask_rollup;
    `);
};
