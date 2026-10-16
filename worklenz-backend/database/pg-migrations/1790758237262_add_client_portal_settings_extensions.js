'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Portal Settings redesign — branding/theme, structured company address fields,
-- per-section client visibility, client notification preferences, POC self-management labels,
-- and invoice template style. See
-- docs/client_portal_admin_redesign/spec-2026-09-18-client-portal-settings.md.

ALTER TABLE client_portal_settings
  ADD COLUMN IF NOT EXISTS portal_title TEXT,
  ADD COLUMN IF NOT EXISTS portal_theme TEXT NOT NULL DEFAULT 'light' CHECK (portal_theme IN ('light', 'dark')),

  -- Company Details — structured City / State / Zip / Country fields, alongside the existing
  -- free-text address_line_1/address_line_2. All optional — none of the four is required.
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,

  -- Client Visible Selection — Invoices and Feedback Forms default OFF, everything else ON.
  ADD COLUMN IF NOT EXISTS visible_project_plan BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_gantt_timeline BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_files_documents BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_invoices BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visible_feedback_forms BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visible_team_members BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_project_updates BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_chat BOOLEAN NOT NULL DEFAULT TRUE,

  -- Client Notifications
  ADD COLUMN IF NOT EXISTS notify_new_message BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_task_status_change BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_file_uploaded BOOLEAN NOT NULL DEFAULT FALSE,

  -- Client User Management — directory-label-only until the client-facing portal enforces them.
  ADD COLUMN IF NOT EXISTS poc_can_add_users BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS poc_can_remove_users BOOLEAN NOT NULL DEFAULT FALSE,

  -- Invoice Template
  ADD COLUMN IF NOT EXISTS invoice_template_style TEXT NOT NULL DEFAULT 'classic' CHECK (invoice_template_style IN ('classic', 'modern')),
  ADD COLUMN IF NOT EXISTS invoice_show_logo BOOLEAN NOT NULL DEFAULT TRUE;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
