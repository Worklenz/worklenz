-- PPM Migration 010: Fix magic link functions bypassing RLS
--
-- Root cause: ppm_client_users has RLS with a policy that casts
-- current_setting('ppm.current_client_id') to UUID. When the magic link
-- auth functions run before any session exists, the setting is empty or
-- unset, causing ''::UUID to throw an error inside the RLS policy
-- evaluation. This makes the UPDATE match 0 rows (or fail outright).
--
-- The functions are SECURITY DEFINER, so they run as the function owner
-- (the role that ran the migration). If that role is the table owner,
-- RLS is bypassed by default — but only if the role is also a superuser
-- or the table owner. In practice the application may connect as a
-- non-superuser role, and SET ROLE or connection pooling can change
-- which role effectively owns the function execution context.
--
-- Fix: Recreate both functions to look up the client_id first, then set
-- ppm.current_client_id via set_config() before performing the UPDATE.
-- This ensures the RLS policy passes regardless of the execution context.
-- The initial SELECT works because SECURITY DEFINER runs as the function
-- owner (table owner), which bypasses RLS.

CREATE OR REPLACE FUNCTION ppm_generate_magic_link(p_email TEXT, p_expires_in INTERVAL DEFAULT '30 minutes')
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_client_id UUID;
BEGIN
    v_token := encode(gen_random_bytes(32), 'hex');

    -- Look up the client_id for this email.
    -- Runs as function owner (SECURITY DEFINER) so bypasses RLS.
    SELECT client_id INTO v_client_id
    FROM ppm_client_users
    WHERE email = p_email
      AND deactivated_at IS NULL;

    IF v_client_id IS NULL THEN
        -- Email not found — return a dummy token to prevent enumeration.
        -- The caller sends "check your email" regardless; no link is actually sent.
        RETURN encode(gen_random_bytes(32), 'hex');
    END IF;

    -- Set the RLS context so the policy check passes on UPDATE.
    PERFORM set_config('ppm.current_client_id', v_client_id::TEXT, true);

    UPDATE ppm_client_users
    SET magic_link_token = v_token,
        magic_link_expires_at = NOW() + p_expires_in
    WHERE email = p_email
      AND deactivated_at IS NULL;

    IF NOT FOUND THEN
        -- Should not happen after the SELECT above, but be safe.
        v_token := encode(gen_random_bytes(32), 'hex');
    END IF;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION ppm_validate_magic_link(p_token TEXT)
RETURNS TABLE(user_id UUID, email TEXT, client_id UUID, role TEXT) AS $$
DECLARE
    v_client_id UUID;
BEGIN
    -- Look up the client_id for this token first.
    -- Runs as function owner (SECURITY DEFINER) so bypasses RLS.
    SELECT cu.client_id INTO v_client_id
    FROM ppm_client_users cu
    WHERE cu.magic_link_token = p_token
      AND cu.magic_link_expires_at > NOW()
      AND cu.deactivated_at IS NULL;

    IF v_client_id IS NULL THEN
        -- Invalid or expired token — return empty result set.
        RETURN;
    END IF;

    -- Set the RLS context so the policy check passes on UPDATE.
    PERFORM set_config('ppm.current_client_id', v_client_id::TEXT, true);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-apply permission grants from migration 009
REVOKE ALL ON FUNCTION ppm_generate_magic_link(TEXT, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION ppm_validate_magic_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm_validate_magic_link(TEXT) TO ppm_client_role;
