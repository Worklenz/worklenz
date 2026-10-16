'use strict';
// Client Portal v2 (#2503 Client-Visible Tasks).
//
// Tasks gain one portal property: Internal Only (default) or Client Visible, plus optional
// client-facing wording so technical task names never reach the client. This lives in a side
// table instead of columns on the hot tasks table:
//   - a task with NO row is Internal Only, which satisfies "every existing task is Internal Only"
//     with no backfill and no change to the tasks table
//   - the wording survives switching a task back to Internal Only and on again
//   - deleting the task removes its row (ON DELETE CASCADE)
//
// Time estimates, time logs, costs, billing rates, dependencies, internal comments and private
// assignee notes are never part of any client payload, whatever the visibility; that is enforced
// by the serializers, not by this schema.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_task_settings (
        task_id            UUID                     PRIMARY KEY REFERENCES tasks (id) ON DELETE CASCADE,
        project_id         UUID                     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        visibility         TEXT                     NOT NULL DEFAULT 'internal',
        client_title       TEXT                     NOT NULL DEFAULT '',
        client_description TEXT                     NOT NULL DEFAULT '',
        updated_by         UUID                     REFERENCES users (id) ON DELETE SET NULL,
        created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_task_settings_visibility_check
            CHECK (visibility IN ('internal', 'client'))
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_task_settings_project_visibility
        ON client_portal_task_settings (project_id, visibility);

    -- Project files attached to a task. A client sees an attachment only when the file is
    -- independently Client Visible; a hidden file is never shown or counted.
    CREATE TABLE IF NOT EXISTS client_portal_task_files (
        task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
        file_id UUID NOT NULL REFERENCES project_files (id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, file_id)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_task_files_file
        ON client_portal_task_files (file_id);

    COMMENT ON TABLE client_portal_task_settings IS
      'Client Portal v2 per-task sharing. No row = Internal Only. Wording is kept when a task is switched back to Internal Only.';
    COMMENT ON TABLE client_portal_task_files IS
      'Project files attached to a shared task. Visible to a client only if the file is itself Client Visible.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_task_files;
    DROP TABLE IF EXISTS client_portal_task_settings;
  `);
};
