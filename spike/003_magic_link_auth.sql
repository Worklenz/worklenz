-- Kill-Shot Spike 1d: Magic Link Auth
-- Proves: client portal auth works alongside Worklenz's Passport.js sessions

-- Add magic link functions
CREATE OR REPLACE FUNCTION ppm_generate_magic_link(
    p_email TEXT,
    p_expires_minutes INTEGER DEFAULT 30
) RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_client_user_id UUID;
BEGIN
    -- Generate secure random token
    v_token := encode(gen_random_bytes(32), 'hex');

    -- Update the client user's magic link token
    UPDATE ppm_client_users
    SET magic_link_token = v_token,
        magic_link_expires_at = NOW() + (p_expires_minutes || ' minutes')::INTERVAL
    WHERE email = p_email AND deactivated_at IS NULL
    RETURNING id INTO v_client_user_id;

    IF v_client_user_id IS NULL THEN
        RAISE EXCEPTION 'Client user not found or deactivated: %', p_email;
    END IF;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ppm_validate_magic_link(
    p_token TEXT
) RETURNS TABLE(user_id UUID, email TEXT, client_id UUID, role TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT cu.id, cu.email, cu.client_id, cu.role
    FROM ppm_client_users cu
    WHERE cu.magic_link_token = p_token
      AND cu.magic_link_expires_at > NOW()
      AND cu.deactivated_at IS NULL;

    -- Invalidate the token after use (one-time use)
    UPDATE ppm_client_users
    SET magic_link_token = NULL, magic_link_expires_at = NULL
    WHERE magic_link_token = p_token;
END;
$$ LANGUAGE plpgsql;
