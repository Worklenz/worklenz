-- PPM Phase 2 Migration 001: ppm_clients
-- Core client table — every PPM deliverable, retainer, and portal user hangs off this.
-- Replaces Monday's per-client board structure with a single row per client.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- required for gen_random_bytes() in magic link auth

CREATE TABLE IF NOT EXISTS ppm_clients (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT        NOT NULL,
    status                   TEXT        NOT NULL DEFAULT 'active_project'
        CHECK (status IN ('lead', 'pipeline', 'negotiation', 'onboarding',
                          'active_project', 'active_retainer', 'past')),
    primary_partner_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
    branding_config          JSONB       DEFAULT '{}'::JSONB,
    contracted_scope         TEXT,
    contracted_hours_monthly NUMERIC(8,2),
    website                  TEXT,
    contact_name             TEXT,
    contact_email            TEXT,
    contact_phone            TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at           TIMESTAMPTZ
);

CREATE INDEX idx_ppm_clients_status ON ppm_clients (status);
CREATE INDEX idx_ppm_clients_primary_partner ON ppm_clients (primary_partner_id);

COMMENT ON TABLE ppm_clients IS 'PPM agency clients. Each client maps to one Worklenz project.';
