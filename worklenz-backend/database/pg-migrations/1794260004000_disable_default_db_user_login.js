// Only disable worklenz_backend login if it is still using the known static default password.
// Preserves existing deployments that configured a custom password for worklenz_backend.
exports.up = pgm => {
  pgm.sql(`
    DO $$
    DECLARE
      v_passwd text;
    BEGIN
      -- Do not alter role if it is the current user executing the migration
      IF CURRENT_USER = 'worklenz_backend' THEN
        RETURN;
      END IF;

      -- Check pg_shadow to see if worklenz_backend is still using the published default password
      BEGIN
        SELECT passwd INTO v_passwd FROM pg_catalog.pg_shadow WHERE usename = 'worklenz_backend';
        -- 'md570e3006bad4ebdfc7c5dcc97b778bed0' is md5('n?&bb24=aWmnw+G@' || 'worklenz_backend')
        IF v_passwd = 'md570e3006bad4ebdfc7c5dcc97b778bed0' THEN
          ALTER ROLE worklenz_backend WITH NOLOGIN;
        END IF;
      EXCEPTION
        WHEN insufficient_privilege THEN
          -- Cannot inspect pg_shadow; do not alter existing role to avoid breaking custom logins
          NULL;
        WHEN undefined_table THEN
          NULL;
      END;
    END
    $$;
  `);
};

exports.down = pgm => {
  // No-op to avoid re-introducing insecure password defaults
};
