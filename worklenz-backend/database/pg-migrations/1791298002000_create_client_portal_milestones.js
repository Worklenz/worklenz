'use strict';
// Client Portal v2 (#2507 Milestones).
//
// A business-level view of a project's lifecycle ("Site architecture & wireframes", "Launch").
// project_phases is Gantt/planning data and cannot carry visibility, completion notes or internal
// notes, so milestones are their own table. Internal Only is the default; a milestone reaches the
// client only once marked Client Visible, and internal_note is never part of any client payload.
//
// Linked work: a milestone can reference the project's tasks and files. The client sees a linked
// item only when that item is itself Client Visible. Deleting a task or file silently removes the
// link (ON DELETE CASCADE), which is the spec's open question answered conservatively.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_milestones (
        id              UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id         UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        project_id      UUID                     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        name            TEXT                     NOT NULL,
        description     TEXT                     NOT NULL DEFAULT '',
        target_date     DATE                     NOT NULL,
        completed_at    DATE,
        status          TEXT                     NOT NULL DEFAULT 'upcoming',
        visibility      TEXT                     NOT NULL DEFAULT 'internal',
        completion_note TEXT                     NOT NULL DEFAULT '',
        internal_note   TEXT                     NOT NULL DEFAULT '',
        created_by      UUID                     REFERENCES users (id) ON DELETE SET NULL,
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_milestones_name_check
            CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
        CONSTRAINT client_portal_milestones_status_check
            CHECK (status IN ('upcoming', 'in_progress', 'completed', 'delayed')),
        CONSTRAINT client_portal_milestones_visibility_check
            CHECK (visibility IN ('internal', 'client'))
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_milestones_project
        ON client_portal_milestones (project_id, target_date);

    CREATE INDEX IF NOT EXISTS idx_client_portal_milestones_project_visibility
        ON client_portal_milestones (project_id, visibility);

    CREATE TABLE IF NOT EXISTS client_portal_milestone_links (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        milestone_id UUID NOT NULL REFERENCES client_portal_milestones (id) ON DELETE CASCADE,
        task_id      UUID REFERENCES tasks (id) ON DELETE CASCADE,
        file_id      UUID REFERENCES project_files (id) ON DELETE CASCADE,
        CONSTRAINT client_portal_milestone_links_one_target_check
            CHECK ((task_id IS NOT NULL)::int + (file_id IS NOT NULL)::int = 1)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_milestone_links_task_uindex
        ON client_portal_milestone_links (milestone_id, task_id) WHERE task_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_milestone_links_file_uindex
        ON client_portal_milestone_links (milestone_id, file_id) WHERE file_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_milestone_links_task
        ON client_portal_milestone_links (task_id) WHERE task_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_milestone_links_file
        ON client_portal_milestone_links (file_id) WHERE file_id IS NOT NULL;

    COMMENT ON TABLE client_portal_milestones IS
      'Client Portal v2 milestones. visibility defaults to internal; internal_note is never part of any client payload.';
    COMMENT ON TABLE client_portal_milestone_links IS
      'Tasks and files linked to a milestone. A client sees a link only when the linked item is itself Client Visible.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_milestone_links;
    DROP TABLE IF EXISTS client_portal_milestones;
  `);
};
