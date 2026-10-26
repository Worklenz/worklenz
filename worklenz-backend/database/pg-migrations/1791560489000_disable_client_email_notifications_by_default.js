'use strict';

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_contact_notification_prefs
        ALTER COLUMN email SET DEFAULT FALSE;

    COMMENT ON TABLE client_contact_notification_prefs IS
      'Per client user email preference per event. In-app notifications are always on; no row or default = email off.';

    ALTER TABLE client_portal_settings
        ALTER COLUMN client_email_events SET DEFAULT
            '{"approval_request":false,"comment_or_reply":false,"file_shared":false,"milestone_change":false,"project_update":false,"change_request_update":false,"access_changes":false}'::jsonb;

    UPDATE client_portal_settings
       SET client_email_events = '{"approval_request":false,"comment_or_reply":false,"file_shared":false,"milestone_change":false,"project_update":false,"change_request_update":false,"access_changes":false}'::jsonb
     WHERE client_email_events = '{"approval_request":true,"comment_or_reply":true,"file_shared":false,"milestone_change":false,"project_update":false,"change_request_update":true,"access_changes":true}'::jsonb;

    ALTER TABLE client_portal_settings
        ALTER COLUMN team_email_events SET DEFAULT
            '{"client_comment":false,"approval_decision":false,"change_request":false,"client_file_upload":false}'::jsonb;

    UPDATE client_portal_settings
       SET team_email_events = '{"client_comment":false,"approval_decision":false,"change_request":false,"client_file_upload":false}'::jsonb
     WHERE team_email_events = '{"client_comment":true,"approval_decision":true,"change_request":true,"client_file_upload":false}'::jsonb;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_settings
        ALTER COLUMN team_email_events SET DEFAULT
            '{"client_comment":true,"approval_decision":true,"change_request":true,"client_file_upload":false}'::jsonb;

    ALTER TABLE client_portal_settings
        ALTER COLUMN client_email_events SET DEFAULT
            '{"approval_request":true,"comment_or_reply":true,"file_shared":false,"milestone_change":false,"project_update":false,"change_request_update":true,"access_changes":true}'::jsonb;

    ALTER TABLE client_contact_notification_prefs
        ALTER COLUMN email SET DEFAULT TRUE;

    COMMENT ON TABLE client_contact_notification_prefs IS
      'Per client user email preference per event. In-app notifications are always on; no row = email on.';
  `);
};
