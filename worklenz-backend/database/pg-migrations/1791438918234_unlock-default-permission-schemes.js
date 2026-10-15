'use strict';
// Roles & Permissions: team Owners and Admins must be able to edit the default
// permission scheme. Unlocks existing default schemes and grants Admins the
// "Manage scheme" permission on them.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE permission_schemes
    SET is_locked = FALSE, updated_at = NOW()
    WHERE is_default = TRUE AND is_locked = TRUE;

    UPDATE permission_scheme_grants psg
    SET granted = TRUE
    FROM permission_schemes ps
    WHERE ps.id = psg.scheme_id
      AND ps.is_default = TRUE
      AND psg.role_name = 'Admin'
      AND psg.permission = 'Manage scheme';
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    UPDATE permission_scheme_grants psg
    SET granted = FALSE
    FROM permission_schemes ps
    WHERE ps.id = psg.scheme_id
      AND ps.is_default = TRUE
      AND psg.role_name = 'Admin'
      AND psg.permission = 'Manage scheme';

    UPDATE permission_schemes
    SET is_locked = TRUE, updated_at = NOW()
    WHERE is_default = TRUE;
  `);
};
