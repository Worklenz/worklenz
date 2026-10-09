'use strict';
// Workspace-wide, append-only Audit Log (Admin Center > Security > Audit Log).
// Spec: Audit log spec - comprehensive audit trail for ISMS / PCI DSS evidence.
//
// Scope decision: "workspace" in the spec maps to Worklenz's `organizations` entity, not
// `teams`. Admin Center (where this page lives) is organization-scoped end-to-end today -
// see adminCenterApiRouter's /organization/users, /organization/teams, /organization/projects,
// and billing routes, all gated by teamOwnerOrAdminValidator against the active team's owning
// organization. "Teams" is itself one of several sub-pages under that same organization, so an
// audit trail scoped to a single team would fragment exactly the cross-team visibility an
// Owner/Admin and an external auditor need. `team_id` is still recorded (nullable) for the
// subset of events that happened inside one particular team, but `organization_id` is the
// tenant boundary this table (and its indexes) are built around.
//
// This migration covers spec tasks 1.1 (table + indexes) and 1.2 (append-only enforcement).

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
      organization_id UUID                                                NOT NULL,
      team_id         UUID,
      actor_user_id   UUID,
      -- Snapshot of the actor's display name at the time of the event. The audit log is
      -- evidentiary: a user being removed or deleted later must not blank out who performed
      -- a historical action, so this is captured independently of the actor_user_id FK below
      -- (which is nullable and set to NULL on delete).
      actor_name      TEXT                                                NOT NULL,
      -- Bounded, stable set (4 categories per spec). CHECK rather than a native PG ENUM so the
      -- allowed set and its UI labels stay driven from one shared TS constants module (task 1.4)
      -- instead of two sources of truth.
      category        TEXT                                                NOT NULL
                           CHECK (category IN ('access', 'user', 'permission', 'lifecycle')),
      -- Open-ended catalog of concrete event types (e.g. 'login_failed', 'role_changed').
      -- Deliberately NOT CHECK-bound: the catalog is expected to grow (task 1.4) and new event
      -- types should ship without a migration. Validity is enforced at the application layer
      -- against the shared constants module instead.
      event_type      TEXT                                                NOT NULL,
      -- Always-populated, human-readable summary of what happened. old_value/new_value below
      -- are a supplement for events where a discrete before/after value exists - description
      -- is the field that guarantees every entry is readable even when it doesn't (per spec's
      -- own [NEED] about old/new not being feasible for every event type).
      description     TEXT                                                NOT NULL,
      old_value       TEXT,
      new_value       TEXT,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
    );

    ALTER TABLE audit_events
      ADD CONSTRAINT audit_events_pk PRIMARY KEY (id);

    ALTER TABLE audit_events
      ADD CONSTRAINT audit_events_organization_id_fk
        FOREIGN KEY (organization_id) REFERENCES organizations
          ON DELETE CASCADE;

    ALTER TABLE audit_events
      ADD CONSTRAINT audit_events_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
          ON DELETE SET NULL;

    -- ON DELETE SET NULL (not CASCADE, not RESTRICT): deleting a user account must never delete
    -- or block deletion of historical audit evidence. actor_name above preserves attribution.
    ALTER TABLE audit_events
      ADD CONSTRAINT audit_events_actor_user_id_fk
        FOREIGN KEY (actor_user_id) REFERENCES users
          ON DELETE SET NULL;

    COMMENT ON TABLE audit_events IS
      'Append-only, workspace(organization)-wide audit trail for Admin Center > Security > Audit Log. Separate from task_activity_logs (per-task, unaffected by this table).';
    COMMENT ON COLUMN audit_events.actor_name IS
      'Snapshot of the actor''s display name at event time; survives actor_user_id being set NULL on user deletion.';
    COMMENT ON COLUMN audit_events.category IS
      'One of: access (Access & Authentication), user (User & Role Management), permission (Permission & Settings Changes), lifecycle (Project/Workspace Lifecycle).';

    -- Primary listing query: most-recent-first within a workspace.
    CREATE INDEX IF NOT EXISTS idx_audit_events_org_created_at
      ON audit_events (organization_id, created_at DESC);

    -- Category filter (multi-select per spec).
    CREATE INDEX IF NOT EXISTS idx_audit_events_org_category
      ON audit_events (organization_id, category);

    -- Actor filter (searchable user picker per spec).
    CREATE INDEX IF NOT EXISTS idx_audit_events_org_actor
      ON audit_events (organization_id, actor_user_id);

    -- FK lookup/filter support; team_id is nullable so a partial index would also work, but a
    -- plain index keeps this consistent with the other FK indexes in this file.
    CREATE INDEX IF NOT EXISTS idx_audit_events_team_id
      ON audit_events (team_id);

    -- --------------------------------------------------------------------------------------
    -- 1.2 Append-only enforcement
    -- --------------------------------------------------------------------------------------
    -- This trigger blocks every UPDATE/DELETE on this table unless it originates from the
    -- retention purge function (task 1.3), which flips a transaction-local flag immediately
    -- before it deletes.
    CREATE OR REPLACE FUNCTION prevent_audit_events_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF current_setting('worklenz.audit_purge_in_progress', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'audit_events is append-only: % is not permitted (only the retention purge job may remove entries)', TG_OP;
      END IF;

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS prevent_audit_events_mutation_trigger ON audit_events;

    CREATE TRIGGER prevent_audit_events_mutation_trigger
      BEFORE UPDATE OR DELETE ON audit_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_events_mutation();
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS prevent_audit_events_mutation_trigger ON audit_events;
    DROP FUNCTION IF EXISTS prevent_audit_events_mutation();

    DROP INDEX IF EXISTS idx_audit_events_team_id;
    DROP INDEX IF EXISTS idx_audit_events_org_actor;
    DROP INDEX IF EXISTS idx_audit_events_org_category;
    DROP INDEX IF EXISTS idx_audit_events_org_created_at;

    DROP TABLE IF EXISTS audit_events;
  `);
};
