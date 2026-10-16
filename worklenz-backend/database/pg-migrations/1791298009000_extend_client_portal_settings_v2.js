'use strict';
// Client Portal v2 (#2511 Portal Settings).
//
// Company Details and Branding are unchanged. This adds what the four rebuilt sections persist:
//   Sharing & Visibility  allow_client_uploads_default  (Show Invoices keeps using visible_invoices)
//   Client Roles          reuses poc_can_add_users / poc_can_remove_users as "Client Admins can
//                         invite / remove users" (no rename, so v1 readers keep working)
//   Notifications         client_email_events / team_email_events (in-app is always on)
//
// There is no sign-in configuration: clients always sign in with a one-time code emailed to an
// address the team (or a Client Admin) has added, reached from an invitation / magic link or by typing
// the address on the sign-in page. See 1791298011000_client_portal_otp_sign_in.js.
//
// The other seven visible_* toggles (project plan, gantt, files, feedback forms, team members,
// project updates, chat) are replaced by item-level sharing and are simply no longer read.
//
// UNIQUE(organization_team_id): the settings controller assumes one row per team but nothing
// enforced it. Any duplicate rows are removed first, keeping the most recently updated one.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    DELETE FROM client_portal_settings s
     USING (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY organization_team_id
                 ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id
               ) AS rn
          FROM client_portal_settings
     ) d
     WHERE s.id = d.id
       AND d.rn > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_settings_org_team_uindex
        ON client_portal_settings (organization_team_id);

    ALTER TABLE client_portal_settings
        ADD COLUMN IF NOT EXISTS allow_client_uploads_default  BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS client_email_events           JSONB   NOT NULL DEFAULT
            '{"approval_request":true,"comment_or_reply":true,"file_shared":false,"milestone_change":false,"project_update":false,"change_request_update":true,"access_changes":true}'::jsonb,
        ADD COLUMN IF NOT EXISTS team_email_events             JSONB   NOT NULL DEFAULT
            '{"client_comment":true,"approval_decision":true,"change_request":true,"client_file_upload":false}'::jsonb;

    COMMENT ON COLUMN client_portal_settings.poc_can_add_users IS
      'v2: "Let Client Admins invite users" (column name kept from v1).';
    COMMENT ON COLUMN client_portal_settings.poc_can_remove_users IS
      'v2: "Let Client Admins remove users" (column name kept from v1).';
    COMMENT ON COLUMN client_portal_settings.client_email_events IS
      'Which client notification events also send email. In-app notifications are always on.';
    COMMENT ON COLUMN client_portal_settings.team_email_events IS
      'Which client activity events also email the internal team. The bell is always on.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Duplicate rows removed by the up migration are not restored.
  pgm.sql(`
    ALTER TABLE client_portal_settings
        DROP COLUMN IF EXISTS team_email_events,
        DROP COLUMN IF EXISTS client_email_events,
        DROP COLUMN IF EXISTS allow_client_uploads_default;

    DROP INDEX IF EXISTS client_portal_settings_org_team_uindex;

    COMMENT ON COLUMN client_portal_settings.poc_can_add_users IS NULL;
    COMMENT ON COLUMN client_portal_settings.poc_can_remove_users IS NULL;
  `);
};
