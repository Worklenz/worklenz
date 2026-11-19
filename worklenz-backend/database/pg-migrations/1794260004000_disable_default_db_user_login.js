// Disable public password login for worklenz_backend on existing installations unless explicitly configured
exports.up = pgm => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'worklenz_backend') THEN
        ALTER ROLE worklenz_backend WITH NOLOGIN;
      END IF;
    END
    $$;
  `);
};

exports.down = pgm => {
  // No-op to avoid re-introducing insecure password defaults
};
