'use strict';
// Team-defined custom statuses for client portal requests. A request's status can be one of the
// 5 built-in workflow states, or one of these team-defined labels. Custom status names can't be
// validated by a plain CHECK constraint (it can't reference another table's rows), so the old
// constraint is dropped and status is validated against (built-ins UNION this table, for the
// caller's team) at the application layer.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_request_custom_statuses (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT 'default',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_request_custom_statuses_org_team_lower_name
        ON client_portal_request_custom_statuses (organization_team_id, LOWER(name));

    ALTER TABLE client_portal_requests DROP CONSTRAINT IF EXISTS client_portal_requests_status_check;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // client_portal_requests_status_check is intentionally not restored: re-adding a CHECK
  // constraint here could reject rows already holding a custom status.
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_request_custom_statuses;
  `);
};
