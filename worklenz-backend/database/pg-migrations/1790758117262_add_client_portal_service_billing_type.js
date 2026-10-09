'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add billing_type to client_portal_services
-- Services are now created/edited with a billing type (Fixed / Recurring / Package / custom),
-- alongside the existing category field. Free text, same as category — validated against
-- (built-ins UNION client_portal_service_option_values, for the caller's team) at the
-- application layer rather than a CHECK constraint, so team-added custom values work.

ALTER TABLE client_portal_services
ADD COLUMN IF NOT EXISTS billing_type TEXT;

COMMENT ON COLUMN client_portal_services.billing_type IS 'Billing type for the service (e.g., Fixed, Recurring, Package, or a team-defined custom value)';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
