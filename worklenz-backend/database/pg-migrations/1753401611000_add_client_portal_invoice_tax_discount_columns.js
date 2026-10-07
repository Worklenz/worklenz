'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Columns present on released databases but never added by a public migration.
 * Idempotent: a no-op where they already exist.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE client_portal_invoices ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) DEFAULT 0;
ALTER TABLE client_portal_invoices ADD COLUMN IF NOT EXISTS tax_amount numeric(10,2) DEFAULT 0;
ALTER TABLE client_portal_invoices ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage'::text;
ALTER TABLE client_portal_invoices ADD COLUMN IF NOT EXISTS discount_value numeric(10,2) DEFAULT 0;
ALTER TABLE client_portal_invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;
ALTER TABLE client_portal_invoices ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) DEFAULT 0;
  `);
};

exports.down = async (_pgm) => {};
