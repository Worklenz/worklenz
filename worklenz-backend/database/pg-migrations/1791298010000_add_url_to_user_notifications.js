'use strict';
// Client Portal v2 (#2508 Internal Notifications).
//
// The staff bell (user_notifications) derives every deep link from project_id / task_id, which
// cannot point at an approval, a change request, a discussion thread or a client user. This adds
// an optional url so a portal notification can open the exact item. When url is null the bell keeps
// using its existing project / task link, so every current notification behaves as before.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS url TEXT;

    COMMENT ON COLUMN user_notifications.url IS
      'Optional in-app deep link (e.g. /worklenz/client-portal/approvals/<id>). Null = derive from project_id / task_id.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE user_notifications DROP COLUMN IF EXISTS url;
  `);
};
