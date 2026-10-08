/**
 * Migration: Add Time Entries view preferences to team_members
 * Date: 2026-09-22
 * Description: Persists each user's Group-by and All/My scope choice on the
 *              Time Entries page, per user per team (issue #2364). Mirrors
 *              the project_members.task_list_group_by/board_group_by
 *              precedent, one grain up since Time Entries isn't project-scoped.
 *
 *              These columns are a UX convenience only — the server always
 *              re-resolves the viewer's actual visibility scope on every read
 *              (see worklenz-backend/src/shared/time-entries-visibility.ts)
 *              rather than trusting time_entries_scope as a grant of access.
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE team_members
      ADD COLUMN IF NOT EXISTS time_entries_group_by TEXT NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS time_entries_scope     TEXT NOT NULL DEFAULT 'all';

    ALTER TABLE team_members
      DROP CONSTRAINT IF EXISTS team_members_time_entries_group_by_check,
      DROP CONSTRAINT IF EXISTS team_members_time_entries_scope_check;

    ALTER TABLE team_members
      ADD CONSTRAINT team_members_time_entries_group_by_check
        CHECK (time_entries_group_by IN ('none', 'member', 'client', 'project', 'task')),
      ADD CONSTRAINT team_members_time_entries_scope_check
        CHECK (time_entries_scope IN ('my', 'all'));

    COMMENT ON COLUMN team_members.time_entries_group_by IS
      'Saved Group-by preference for the Time Entries page (none|member|client|project|task).';
    COMMENT ON COLUMN team_members.time_entries_scope IS
      'Saved All-entries/My-entries scope preference for the Time Entries page (my|all), defaulting to all. UX convenience only -- the server always re-validates against the viewer''s resolved visibility scope on every read, never trusts this column as a grant of access.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE team_members
      DROP CONSTRAINT IF EXISTS team_members_time_entries_group_by_check,
      DROP CONSTRAINT IF EXISTS team_members_time_entries_scope_check;

    ALTER TABLE team_members
      DROP COLUMN IF EXISTS time_entries_group_by,
      DROP COLUMN IF EXISTS time_entries_scope;
  `);
};
