'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add team-defined custom Category / Billing type values for client portal services
-- A service's category and billing_type are free text columns; this table only stores the
-- *picklist* of values an org has added (built-ins UNION this table, filtered by kind, for the
-- caller's team), the same relationship client_portal_request_custom_statuses has to
-- client_portal_requests.status.

CREATE TABLE IF NOT EXISTS client_portal_service_option_values (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('category', 'billing_type')),
    value TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- A plain table-level UNIQUE constraint can't reference an expression like LOWER(value), only
-- column names — a unique index is the correct way to get case-insensitive uniqueness here.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_service_option_values_unique
    ON client_portal_service_option_values(organization_team_id, kind, LOWER(value));

CREATE INDEX IF NOT EXISTS idx_client_portal_service_option_values_org_team_id
    ON client_portal_service_option_values(organization_team_id, kind);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
