'use strict';
// Converted from: database/migrations/release-v2.3.0/002-add-unique-constraint-to-client-portal-access.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add unique constraint to client_portal_access
-- Description: Adds a unique constraint to the client_id column in the client_portal_access table to support ON CONFLICT statements.
-- Date: 2025-12-12
-- Version: 2.3.0

ALTER TABLE client_portal_access
ADD CONSTRAINT IF NOT EXISTS client_portal_access_client_id_key UNIQUE (client_id);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
