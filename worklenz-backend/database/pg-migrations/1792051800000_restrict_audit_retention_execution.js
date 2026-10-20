'use strict';

// Keep the privileged purge private on existing installations without requiring any
// deployment-specific role. Worker permissions are provisioned separately by an admin.
exports.up = pgm => {
  pgm.sql(`
    REVOKE ALL ON FUNCTION purge_expired_audit_events(UUID) FROM PUBLIC;
  `);
};

exports.down = () => {
  // Do not restore public execution of a SECURITY DEFINER function on rollback.
};
