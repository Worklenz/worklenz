CREATE OR REPLACE FUNCTION deserialize_user(_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    -- Optimized version using CTEs for better performance and maintainability
    WITH user_team_data AS (
        SELECT 
            u.id,
            u.name,
            u.email,
            u.timezone_id AS timezone,
            u.avatar_url,
            u.user_no,
            u.socket_id,
            u.created_at AS joined_date,
            u.updated_at AS last_updated,
            u.setup_completed AS my_setup_completed,
            (is_null_or_empty(u.google_id) IS FALSE) AS is_google,
            COALESCE(u.active_team, (SELECT id FROM teams WHERE user_id = u.id LIMIT 1)) AS team_id,
            u.active_team
        FROM users u
        WHERE u.id = _id
    ),
    team_org_data AS (
        SELECT 
            utd.*,
            t.name AS team_name,
            t.user_id AS owner_id,
            o.subscription_status,
            o.license_type_id,
            o.trial_expire_date
        FROM user_team_data utd
        INNER JOIN teams t ON t.id = utd.team_id
        LEFT JOIN organizations o ON o.user_id = t.user_id
    ),
    notification_data AS (
        SELECT 
            tod.*,
            COALESCE(ns.email_notifications_enabled, TRUE) AS email_notifications_enabled
        FROM team_org_data tod
        LEFT JOIN notification_settings ns ON (ns.user_id = tod.id AND ns.team_id = tod.team_id)
    ),
    alerts_data AS (
        SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(alert_rec))), '[]'::JSON) AS alerts
        FROM (SELECT description, type FROM worklenz_alerts WHERE active IS TRUE) alert_rec
    ),
    complete_user_data AS (
        SELECT 
            nd.*,
            tz.name AS timezone_name,
            slt.key AS subscription_type,
            tm.id AS team_member_id,
            ad.alerts,
            CASE
                WHEN nd.subscription_status = 'trialing' THEN nd.trial_expire_date::DATE
                WHEN EXISTS(SELECT 1 FROM licensing_custom_subs WHERE user_id = nd.owner_id) 
                    THEN (SELECT end_date FROM licensing_custom_subs WHERE user_id = nd.owner_id LIMIT 1)::DATE
                WHEN EXISTS(SELECT 1 FROM licensing_user_subscriptions WHERE user_id = nd.owner_id AND active IS TRUE)
                    THEN (SELECT (next_bill_date)::DATE - INTERVAL '1 day' 
                          FROM licensing_user_subscriptions 
                          WHERE user_id = nd.owner_id AND active IS TRUE 
                          LIMIT 1)::DATE
                ELSE NULL
            END AS valid_till_date,
            CASE
                WHEN is_owner(nd.id, nd.active_team) THEN nd.my_setup_completed
                ELSE TRUE 
            END AS setup_completed,
            is_owner(nd.id, nd.active_team) AS owner,
            is_admin(nd.id, nd.active_team) AS is_admin
        FROM notification_data nd
        CROSS JOIN alerts_data ad
        LEFT JOIN timezones tz ON tz.id = nd.timezone
        LEFT JOIN sys_license_types slt ON slt.id = nd.license_type_id
        LEFT JOIN team_members tm ON (tm.user_id = nd.id AND tm.team_id = nd.team_id AND tm.active IS TRUE)
    )
    SELECT ROW_TO_JSON(complete_user_data.*) INTO _result FROM complete_user_data;

    -- Ensure notification settings exist using INSERT...ON CONFLICT for better concurrency
    INSERT INTO notification_settings (user_id, team_id, email_notifications_enabled, popup_notifications_enabled, show_unread_items_count)
    SELECT _id, 
           COALESCE((SELECT active_team FROM users WHERE id = _id), 
                   (SELECT id FROM teams WHERE user_id = _id LIMIT 1)),
           TRUE, TRUE, TRUE
    ON CONFLICT (user_id, team_id) DO NOTHING;

    RETURN _result;
END
$$;