/** Operator-owned security policies. No SaaS trial rules or vendor endpoints. */
exports.up = pgm => {
  pgm.sql(String.raw`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS blocked_signup_email_domains (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      domain TEXT NOT NULL UNIQUE CHECK (domain = LOWER(TRIM(domain)) AND domain <> ''),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS blocked_task_content_hosts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      host TEXT NOT NULL UNIQUE CHECK (host = LOWER(TRIM(host)) AND host <> ''),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS security_invitation_policy (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL UNIQUE DEFAULT 'global' CHECK (name = 'global'),
      invitations_paused BOOLEAN NOT NULL DEFAULT FALSE,
      max_per_window INTEGER NOT NULL DEFAULT 100 CHECK (max_per_window >= 0),
      window_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (window_seconds > 0)
    );
    INSERT INTO security_invitation_policy (name) VALUES ('global') ON CONFLICT (name) DO NOTHING;
    CREATE TABLE IF NOT EXISTS security_invitation_counters (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      scope TEXT NOT NULL CHECK (scope IN ('creation', 'email')),
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL CHECK (attempts > 0),
      UNIQUE (team_id, scope)
    );
    CREATE TABLE IF NOT EXISTS security_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      bucket_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', CURRENT_TIMESTAMP),
      attempt_count INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at TIMESTAMPTZ,
      UNIQUE (team_id, event_type, bucket_start)
    );

    -- The row update serializes reservations, including across API processes.
    -- A failed/rolled-back invitation insert also rolls back its reservation.
    CREATE OR REPLACE FUNCTION reserve_security_invitation(_team_id UUID, _scope TEXT) RETURNS VOID
    LANGUAGE plpgsql AS $$
    DECLARE
      _policy security_invitation_policy%ROWTYPE;
      _reserved UUID;
      _now TIMESTAMPTZ := clock_timestamp();
    BEGIN
      IF _team_id IS NULL THEN RAISE EXCEPTION 'ERROR_INVITATION_TEAM_REQUIRED'; END IF;
      SELECT * INTO STRICT _policy FROM security_invitation_policy WHERE name = 'global';
      IF _policy.invitations_paused THEN RAISE EXCEPTION 'ERROR_SECURITY_INVITATIONS_PAUSED'; END IF;
      IF _policy.max_per_window = 0 THEN RETURN; END IF;

      INSERT INTO security_invitation_counters AS counter (team_id, scope, expires_at, attempts)
      VALUES (_team_id, _scope, _now + make_interval(secs => _policy.window_seconds), 1)
      ON CONFLICT (team_id, scope) DO UPDATE
      SET attempts = CASE WHEN counter.expires_at <= _now THEN 1 ELSE counter.attempts + 1 END,
          expires_at = CASE WHEN counter.expires_at <= _now
            THEN _now + make_interval(secs => _policy.window_seconds) ELSE counter.expires_at END
      WHERE counter.expires_at <= _now OR counter.attempts < _policy.max_per_window
      RETURNING id INTO _reserved;
      IF _reserved IS NULL THEN RAISE EXCEPTION 'ERROR_SECURITY_INVITATION_LIMIT'; END IF;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_security_invitation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM reserve_security_invitation(NEW.team_id, 'creation');
      RETURN NEW;
    END;
    $$;
    DROP TRIGGER IF EXISTS security_invitation_guard ON email_invitations;
    CREATE TRIGGER security_invitation_guard BEFORE INSERT ON email_invitations
      FOR EACH ROW EXECUTE FUNCTION enforce_security_invitation();

    -- Decode ASCII HTML entities and percent escapes before extracting URL authorities.
    -- This is a known-host denylist, not a general phishing-content classifier.
    CREATE OR REPLACE FUNCTION security_content_has_blocked_host(_content TEXT) RETURNS BOOLEAN
    LANGUAGE plpgsql STABLE AS $$
    DECLARE
      _normalized TEXT := COALESCE(_content, '');
      _match TEXT[];
      _code INTEGER;
      _authority TEXT;
      _host TEXT;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM blocked_task_content_hosts WHERE active) THEN RETURN FALSE; END IF;
      FOR _match IN SELECT regexp_matches(_normalized, '&#(x[0-9a-f]{1,6}|[0-9]{1,7});?', 'gi') LOOP
        IF LOWER(LEFT(_match[1], 1)) = 'x' THEN
          _code := ('x' || lpad(substr(_match[1], 2), 8, '0'))::bit(32)::int;
        ELSE _code := _match[1]::INTEGER;
        END IF;
        IF _code BETWEEN 1 AND 127 THEN
          _normalized := replace(replace(_normalized, '&#' || _match[1] || ';', chr(_code)), '&#' || _match[1], chr(_code));
        END IF;
      END LOOP;
      _normalized := replace(replace(replace(replace(_normalized,
        '&colon;', ':'), '&sol;', '/'), '&Tab;', ''), '&NewLine;', '');
      _normalized := replace(replace(replace(_normalized, '&period;', '.'), '&commat;', '@'), '&bsol;', chr(92));
      FOR _match IN SELECT regexp_matches(_normalized, '%([0-9a-f]{2})', 'gi') LOOP
        _code := ('x' || _match[1])::bit(8)::int;
        IF _code BETWEEN 1 AND 127 THEN
          _normalized := replace(_normalized, '%' || _match[1], chr(_code));
        END IF;
      END LOOP;
      _normalized := translate(_normalized, E'\t\r\n', '');
      _normalized := replace(_normalized, chr(92), '/');
      FOR _match IN SELECT regexp_matches(_normalized, '(?:https?:)?//([^/?#[:space:]<>"'']+)', 'gi') LOOP
        _authority := regexp_replace(_match[1], '^.*@', '');
        _host := rtrim(LOWER(split_part(_authority, ':', 1)), '.');
        IF EXISTS (SELECT 1 FROM blocked_task_content_hosts
          WHERE active AND (_host = host OR RIGHT(_host, length(host) + 1) = '.' || host)) THEN
          RETURN TRUE;
        END IF;
      END LOOP;
      RETURN FALSE;
    END;
    $$;
    CREATE OR REPLACE FUNCTION enforce_security_task_host() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF security_content_has_blocked_host(NEW.description) THEN
        RAISE EXCEPTION 'ERROR_SECURITY_BLOCKED_TASK_HOST';
      END IF;
      RETURN NEW;
    END;
    $$;
    DROP TRIGGER IF EXISTS security_task_host_guard ON tasks;
    CREATE TRIGGER security_task_host_guard BEFORE INSERT OR UPDATE OF description ON tasks
      FOR EACH ROW EXECUTE FUNCTION enforce_security_task_host();
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS security_task_host_guard ON tasks;
    DROP FUNCTION IF EXISTS enforce_security_task_host();
    DROP FUNCTION IF EXISTS security_content_has_blocked_host(TEXT);
    DROP TRIGGER IF EXISTS security_invitation_guard ON email_invitations;
    DROP FUNCTION IF EXISTS enforce_security_invitation();
    DROP FUNCTION IF EXISTS reserve_security_invitation(UUID, TEXT);
    -- Keep operator policies, blocklists, counters and event history on rollback.
    -- These tables may have existed before this migration ran in production.
  `);
};
