'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Soft-delete columns on client and client portal tables, present in released databases
 * but never added by a public migration.
 * Idempotent: a no-op where the objects already exist (deployed databases).
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE client_invitations ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_invitations_deleted_at ON client_invitations USING btree (deleted_at);
ALTER TABLE client_portal_access ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_portal_access_deleted_at ON client_portal_access USING btree (deleted_at);
ALTER TABLE client_portal_chat_messages ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_portal_chat_messages_deleted_at ON client_portal_chat_messages USING btree (deleted_at);
ALTER TABLE client_portal_invoices ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_portal_invoices_deleted_at ON client_portal_invoices USING btree (deleted_at);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients USING btree (deleted_at);
ALTER TABLE client_portal_requests ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_portal_requests_deleted_at ON client_portal_requests USING btree (deleted_at);
ALTER TABLE client_portal_services ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_portal_services_deleted_at ON client_portal_services USING btree (deleted_at);
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_users_deleted_at ON client_users USING btree (deleted_at);
  `);
};

exports.down = async (_pgm) => {};
