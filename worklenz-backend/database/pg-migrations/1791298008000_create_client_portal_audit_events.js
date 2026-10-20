'use strict';
// Client Portal v2 (#2501 Audit Log).
//
// One append-only log for client and internal actions, each with an actor, a side, a timestamp and
// a target. It answers "who shared this", "who approved that" and "who has access".
//
// It never stores comment bodies or internal notes; target_label is a short human label such as
// "AP-000123 · Approve homepage wireframe v3".
//
// Append-only: a trigger rejects UPDATE and DELETE issued directly against the table
// (pg_trigger_depth() = 1). Referential actions fired by deleting a team, client, project or user
// run at depth >= 2, so they are allowed and a team or client can still be deleted. The foreign
// keys therefore use ON DELETE SET NULL / CASCADE safely, and actor_name / client_name snapshots
// keep events readable after the actor or client is removed.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_audit_events (
        id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id          UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        client_id        UUID                     REFERENCES clients (id) ON DELETE SET NULL,
        project_id       UUID                     REFERENCES projects (id) ON DELETE SET NULL,
        actor_side       TEXT                     NOT NULL,
        actor_user_id    UUID                     REFERENCES users (id) ON DELETE SET NULL,
        actor_contact_id UUID                     REFERENCES client_contacts (id) ON DELETE SET NULL,
        actor_name       TEXT                     NOT NULL,
        event_type       TEXT                     NOT NULL,
        event_key        TEXT                     NOT NULL,
        target_type      TEXT,
        target_id        UUID,
        target_label     TEXT                     NOT NULL DEFAULT '',
        client_name      TEXT,
        metadata         JSONB                    NOT NULL DEFAULT '{}'::jsonb,
        created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_audit_events_side_check CHECK (actor_side IN ('client', 'internal')),
        CONSTRAINT client_portal_audit_events_type_check
            CHECK (event_type IN ('access', 'visibility', 'file', 'comment', 'approval', 'change_request'))
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_audit_events_team_created
        ON client_portal_audit_events (team_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_client_portal_audit_events_client_created
        ON client_portal_audit_events (client_id, created_at DESC) WHERE client_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_audit_events_team_type_created
        ON client_portal_audit_events (team_id, event_type, created_at DESC);

    CREATE OR REPLACE FUNCTION client_portal_audit_events_append_only() RETURNS trigger AS $fn$
    BEGIN
        -- Direct UPDATE / DELETE statements fire this trigger at depth 1 and are rejected.
        -- Foreign-key actions (a deleted team, client, project or user) fire it at depth >= 2.
        IF pg_trigger_depth() > 1 THEN
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'client_portal_audit_events is append-only (% rejected)', TG_OP
            USING ERRCODE = 'restrict_violation';
    END;
    $fn$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS client_portal_audit_events_append_only_trg ON client_portal_audit_events;
    CREATE TRIGGER client_portal_audit_events_append_only_trg
        BEFORE UPDATE OR DELETE ON client_portal_audit_events
        FOR EACH ROW EXECUTE FUNCTION client_portal_audit_events_append_only();

    COMMENT ON TABLE client_portal_audit_events IS
      'Client Portal v2 audit log. Append-only; never stores comment bodies or internal notes.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS client_portal_audit_events_append_only_trg ON client_portal_audit_events;
    DROP FUNCTION IF EXISTS client_portal_audit_events_append_only();
    DROP TABLE IF EXISTS client_portal_audit_events;
  `);
};
