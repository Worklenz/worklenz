// Restrict invitation acceptance for existing installations.
exports.up = pgm => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION accept_invitation(_email text, _team_member_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id UUID;
BEGIN
    -- Lock both rows so an invitation can only be claimed once, by its recipient.
    SELECT tm.team_id INTO _team_id
    FROM team_members tm
    JOIN email_invitations ei ON ei.team_member_id = tm.id AND ei.team_id = tm.team_id
    JOIN users u ON u.id = _user_id AND LOWER(TRIM(u.email)) = LOWER(TRIM(ei.email))
    WHERE tm.id = _team_member_id AND (tm.user_id IS NULL OR tm.user_id = _user_id) AND tm.active IS TRUE
      AND LOWER(TRIM(ei.email)) = LOWER(TRIM(_email))
    FOR UPDATE OF tm, ei;

    IF NOT FOUND THEN RETURN NULL; END IF;

    UPDATE team_members SET user_id = _user_id WHERE id = _team_member_id;
    DELETE FROM email_invitations
    WHERE team_member_id = _team_member_id AND LOWER(TRIM(email)) = LOWER(TRIM(_email));
    UPDATE user_notifications SET read = TRUE
    WHERE user_id = _user_id AND team_id = _team_id
      AND message LIKE '%invited you to work with%' AND read = FALSE;

    RETURN JSON_BUILD_OBJECT('email', _email, 'id', _team_id);
END;
$$;
  `);
};

exports.down = pgm => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION accept_invitation(_email text, _team_member_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id UUID;
BEGIN
    IF _team_member_id IS NOT NULL
    THEN
        -- Get the team_id before updating
        SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
        
        UPDATE team_members SET user_id = _user_id WHERE id = _team_member_id;
        DELETE FROM email_invitations WHERE email = _email AND team_member_id = _team_member_id;
        
        -- Mark all related team invitation notifications as read
        UPDATE user_notifications 
        SET read = TRUE 
        WHERE user_id = _user_id 
          AND team_id = _team_id 
          AND message LIKE '%invited you to work with%'
          AND read = FALSE;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'email', _email,
        'id', (SELECT id FROM teams WHERE id = (SELECT team_id FROM team_members WHERE id = _team_member_id))
        );
END;
$$;
  `);
};
