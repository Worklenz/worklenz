'use strict';

// Existing installations also need this ACL correction; editing the original migration alone
// would leave their SECURITY DEFINER function executable by the application role.
exports.up = pgm => {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worklenz_audit_retention') THEN
        CREATE ROLE worklenz_audit_retention NOLOGIN;
      END IF;
    END $$;
    REVOKE ALL ON FUNCTION purge_expired_audit_events(UUID) FROM PUBLIC;
    REVOKE ALL ON FUNCTION purge_expired_audit_events(UUID) FROM worklenz_client;
    GRANT EXECUTE ON FUNCTION purge_expired_audit_events(UUID) TO worklenz_audit_retention;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    REVOKE EXECUTE ON FUNCTION purge_expired_audit_events(UUID) FROM worklenz_audit_retention;
    GRANT EXECUTE ON FUNCTION purge_expired_audit_events(UUID) TO PUBLIC;
  `);
};
