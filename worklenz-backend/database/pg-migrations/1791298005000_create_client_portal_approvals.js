'use strict';
// Client Portal v2 (#2500 Approvals).
//
// A formal, auditable sign-off: staff ask one client approver to approve a Client Visible file
// (at an exact version), milestone or task, or a free-form item described in the request itself.
//
// Tables
//   client_portal_approval_sequences  per-team counter for AP-000123 reference numbers. Numbers are
//                                     unique and never reused, including for cancelled drafts.
//   client_portal_approvals           the request and its current state
//   client_portal_approval_revisions  one row per revision: what was approved (file version, or an
//                                     item-name / description snapshot) and the decision on it. A
//                                     re-approval is a NEW revision, so a decision is never
//                                     overwritten.
//   client_portal_approval_events     the history timeline, marking client vs internal actors
//
// Decision idempotency: a revision's outcome is written once
// (UPDATE ... WHERE outcome IS NULL), so a repeated decision records a single decision.
//
// Names (approver, creator, item) are snapshotted so history survives a removed client user or a
// renamed / deleted linked item.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_approval_sequences (
        organization_team_id UUID                     PRIMARY KEY REFERENCES teams (id) ON DELETE CASCADE,
        last_number          INTEGER                  NOT NULL DEFAULT 0,
        updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_portal_approvals (
        id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        ref_no               TEXT                     NOT NULL,
        organization_team_id UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        client_id            UUID                     NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
        project_id           UUID                     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        title                TEXT                     NOT NULL,
        linked_type          TEXT                     NOT NULL,
        linked_file_id       UUID                     REFERENCES project_files (id) ON DELETE SET NULL,
        linked_file_version  INTEGER,
        linked_milestone_id  UUID                     REFERENCES client_portal_milestones (id) ON DELETE SET NULL,
        linked_task_id       UUID                     REFERENCES tasks (id) ON DELETE SET NULL,
        item_name            TEXT                     NOT NULL,
        item_task_key        TEXT,
        freeform_description TEXT,
        approver_contact_id  UUID                     REFERENCES client_contacts (id) ON DELETE SET NULL,
        approver_name        TEXT                     NOT NULL,
        instructions         TEXT                     NOT NULL DEFAULT '',
        due_date             DATE,
        status               TEXT                     NOT NULL DEFAULT 'draft',
        revision             INTEGER                  NOT NULL DEFAULT 1,
        created_by           UUID                     REFERENCES users (id) ON DELETE SET NULL,
        created_by_name      TEXT                     NOT NULL,
        created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_approvals_org_ref_no_key UNIQUE (organization_team_id, ref_no),
        CONSTRAINT client_portal_approvals_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
        CONSTRAINT client_portal_approvals_linked_type_check
            CHECK (linked_type IN ('file', 'milestone', 'task', 'freeform')),
        CONSTRAINT client_portal_approvals_status_check
            CHECK (status IN ('draft', 'awaiting', 'approved', 'changes_requested', 'cancelled')),
        CONSTRAINT client_portal_approvals_revision_check CHECK (revision >= 1)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_approvals_org_status
        ON client_portal_approvals (organization_team_id, status);

    CREATE INDEX IF NOT EXISTS idx_client_portal_approvals_client
        ON client_portal_approvals (client_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_client_portal_approvals_project
        ON client_portal_approvals (project_id);

    CREATE INDEX IF NOT EXISTS idx_client_portal_approvals_approver
        ON client_portal_approvals (approver_contact_id) WHERE approver_contact_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_approvals_linked_file
        ON client_portal_approvals (linked_file_id) WHERE linked_file_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS client_portal_approval_revisions (
        id                     UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        approval_id            UUID                     NOT NULL REFERENCES client_portal_approvals (id) ON DELETE CASCADE,
        revision               INTEGER                  NOT NULL,
        file_version           INTEGER,
        item_name              TEXT                     NOT NULL,
        description_snapshot   TEXT,
        outcome                TEXT,
        decided_by_contact_id  UUID                     REFERENCES client_contacts (id) ON DELETE SET NULL,
        decided_by_name        TEXT,
        decided_at             TIMESTAMP WITH TIME ZONE,
        comment                TEXT                     NOT NULL DEFAULT '',
        created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_approval_revisions_revision_key UNIQUE (approval_id, revision),
        CONSTRAINT client_portal_approval_revisions_outcome_check
            CHECK (outcome IS NULL OR outcome IN ('approved', 'changes_requested')),
        CONSTRAINT client_portal_approval_revisions_decided_check
            CHECK ((outcome IS NULL) = (decided_at IS NULL))
    );

    CREATE TABLE IF NOT EXISTS client_portal_approval_events (
        id          UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        approval_id UUID                     NOT NULL REFERENCES client_portal_approvals (id) ON DELETE CASCADE,
        revision    INTEGER                  NOT NULL,
        actor_side  TEXT                     NOT NULL,
        actor_name  TEXT                     NOT NULL,
        text        TEXT                     NOT NULL,
        created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_approval_events_side_check CHECK (actor_side IN ('client', 'internal'))
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_approval_events_approval
        ON client_portal_approval_events (approval_id, created_at);

    COMMENT ON TABLE client_portal_approvals IS
      'Client Portal v2 approvals. Draft is never visible to a client. linked_file_version never changes when the file is replaced.';
    COMMENT ON TABLE client_portal_approval_revisions IS
      'One row per revision with what was approved and the decision on it. A re-approval is a new revision; a decision is never overwritten.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_approval_events;
    DROP TABLE IF EXISTS client_portal_approval_revisions;
    DROP TABLE IF EXISTS client_portal_approvals;
    DROP TABLE IF EXISTS client_portal_approval_sequences;
  `);
};
