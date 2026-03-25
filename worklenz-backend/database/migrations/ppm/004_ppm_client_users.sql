-- PPM Phase 2 Migration 004: ppm_client_users
-- Client portal users — separate from Worklenz internal users.
-- Auth via magic link (primary) or optional password. RLS-isolated by client_id.

CREATE TABLE IF NOT EXISTS ppm_client_users (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 TEXT        NOT NULL UNIQUE,
    display_name          TEXT,
    client_id             UUID        NOT NULL REFERENCES ppm_clients(id) ON DELETE CASCADE,
    role                  TEXT        NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('viewer', 'reviewer', 'admin')),
    invited_by            UUID        REFERENCES users(id) ON DELETE SET NULL,
    magic_link_token      TEXT,
    magic_link_expires_at TIMESTAMPTZ,
    password_hash         TEXT,
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at        TIMESTAMPTZ
);

CREATE INDEX idx_ppm_client_users_client ON ppm_client_users (client_id);
CREATE INDEX idx_ppm_client_users_email  ON ppm_client_users (email);
CREATE INDEX idx_ppm_client_users_token  ON ppm_client_users (magic_link_token)
    WHERE magic_link_token IS NOT NULL;

-- Enable RLS for client isolation (proven in spike 001)
ALTER TABLE ppm_client_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY ppm_client_users_client_isolation ON ppm_client_users
    FOR ALL
    USING (client_id = current_setting('ppm.current_client_id')::UUID);

-- Magic link generation function (proven in spike 003)
CREATE OR REPLACE FUNCTION ppm_generate_magic_link(p_email TEXT, p_expires_in INTERVAL DEFAULT '30 minutes')
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
BEGIN
    v_token := encode(gen_random_bytes(32), 'hex');
    UPDATE ppm_client_users
    SET magic_link_token = v_token,
        magic_link_expires_at = NOW() + p_expires_in
    WHERE email = p_email
      AND deactivated_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active client user found for email: %', p_email;
    END IF;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Magic link validation function (proven in spike 003)
CREATE OR REPLACE FUNCTION ppm_validate_magic_link(p_token TEXT)
RETURNS TABLE(user_id UUID, email TEXT, client_id UUID, role TEXT) AS $$
BEGIN
    RETURN QUERY
    UPDATE ppm_client_users cu
    SET magic_link_token = NULL,
        magic_link_expires_at = NULL,
        last_login_at = NOW()
    WHERE cu.magic_link_token = p_token
      AND cu.magic_link_expires_at > NOW()
      AND cu.deactivated_at IS NULL
    RETURNING cu.id, cu.email, cu.client_id, cu.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE ppm_client_users IS 'PPM client portal users. Auth via magic link or optional password.';
