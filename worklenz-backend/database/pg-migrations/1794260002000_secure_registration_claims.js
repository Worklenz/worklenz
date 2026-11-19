// Validate and lock invitation claims before invoking the existing registration functions.
// Locks are held until the registration transaction completes, preventing concurrent claims.
exports.up = pgm => {
  pgm.sql(`
    ALTER FUNCTION register_user(json) RENAME TO register_user_before_claim_guard;
    ALTER FUNCTION register_google_user(json) RENAME TO register_google_user_before_claim_guard;
    ALTER FUNCTION register_apple_user(json) RENAME TO register_apple_user_before_claim_guard;

    CREATE FUNCTION validate_registration_claim(_team TEXT, _member TEXT, _email TEXT)
    RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      IF NULLIF(_team, '') IS NULL AND NULLIF(_member, '') IS NULL THEN RETURN; END IF;
      IF NULLIF(_team, '') IS NULL OR NULLIF(_member, '') IS NULL OR NULLIF(TRIM(_email), '') IS NULL THEN
        RAISE EXCEPTION 'ERROR_INVALID_JOINING_EMAIL';
      END IF;
      PERFORM tm.id FROM team_members tm
      JOIN email_invitations ei ON ei.team_member_id = tm.id AND ei.team_id = tm.team_id
      WHERE tm.id = _member::UUID AND tm.team_id = _team::UUID
        AND tm.user_id IS NULL AND tm.active IS TRUE
        AND LOWER(TRIM(ei.email)) = LOWER(TRIM(_email))
      FOR UPDATE OF tm, ei;
      IF NOT FOUND THEN RAISE EXCEPTION 'ERROR_INVALID_JOINING_EMAIL'; END IF;
    END;
    $$;

    CREATE FUNCTION register_user(_body json) RETURNS json LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM validate_registration_claim(_body->>'invited_team_id', _body->>'team_member_id', _body->>'email');
      RETURN register_user_before_claim_guard(_body);
    END;
    $$;
    CREATE FUNCTION register_google_user(_body json) RETURNS json LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM validate_registration_claim(_body->>'team', _body->>'member_id', _body->>'email');
      RETURN register_google_user_before_claim_guard(_body);
    END;
    $$;
    CREATE FUNCTION register_apple_user(_body json) RETURNS json LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM validate_registration_claim(_body->>'team', _body->>'member_id', _body->>'email');
      RETURN register_apple_user_before_claim_guard(_body);
    END;
    $$;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP FUNCTION register_user(json);
    DROP FUNCTION register_google_user(json);
    DROP FUNCTION register_apple_user(json);
    DROP FUNCTION validate_registration_claim(TEXT, TEXT, TEXT);
    ALTER FUNCTION register_user_before_claim_guard(json) RENAME TO register_user;
    ALTER FUNCTION register_google_user_before_claim_guard(json) RENAME TO register_google_user;
    ALTER FUNCTION register_apple_user_before_claim_guard(json) RENAME TO register_apple_user;
  `);
};
