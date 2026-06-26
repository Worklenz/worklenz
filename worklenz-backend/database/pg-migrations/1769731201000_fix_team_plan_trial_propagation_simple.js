'use strict';
// Converted from: database/migrations/20260212000001-fix-team-plan-trial-propagation-simple.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix team plan trial propagation using organization data
-- Description: Updates deserialize_user to propagate business plan access from team owner to all team members
-- Date: 2026-02-12

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
            o.trial_expire_date,
            o.id AS organization_id
        FROM user_team_data utd
        INNER JOIN teams t ON t.id = utd.team_id
        LEFT JOIN organizations o ON o.user_id = t.user_id
    ),
    -- Check if team owner has business trial access (exclude self-hosted users)
    owner_trial_data AS (
        SELECT
            CASE 
                WHEN o.subscription_status = 'trialing' AND o.trial_expire_date > NOW() 
                AND slt.key != 'SELF_HOSTED' THEN 'BUSINESS_LARGE'
                ELSE NULL
            END AS active_plan_trial,
            CASE 
                WHEN o.subscription_status = 'trialing' AND o.trial_expire_date > NOW() 
                AND slt.key != 'SELF_HOSTED' THEN o.trial_expire_date
                ELSE NULL
            END AS plan_trial_end_date,
            CASE 
                WHEN o.subscription_status = 'trialing' AND o.trial_expire_date > NOW() 
                AND slt.key != 'SELF_HOSTED' 
                THEN GREATEST(0, EXTRACT(DAY FROM (o.trial_expire_date - NOW()))::INTEGER)
                ELSE 0
            END AS trial_days_remaining,
            CASE 
                WHEN o.subscription_status = 'trialing' AND o.trial_expire_date > NOW() 
                AND slt.key != 'SELF_HOSTED' THEN 'Business'
                ELSE NULL
            END AS trial_plan_display_name
        FROM team_org_data tod
        LEFT JOIN organizations o ON o.user_id = tod.owner_id AND o.id = tod.organization_id
        LEFT JOIN sys_license_types slt ON slt.id = o.license_type_id
    ),
    notification_data AS (
        SELECT
            tod.*,
            otd.active_plan_trial,
            otd.plan_trial_end_date,
            otd.trial_days_remaining,
            otd.trial_plan_display_name,
            COALESCE(ns.email_notifications_enabled, TRUE) AS email_notifications_enabled
        FROM team_org_data tod
        LEFT JOIN owner_trial_data otd ON TRUE
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
            -- Modified subscription type logic to include owner's trial data
            CASE
                WHEN nd.active_plan_trial = 'BUSINESS_LARGE' THEN 'BUSINESS_TRIAL'
                WHEN nd.active_plan_trial IS NOT NULL THEN 'PLAN_TRIAL'
                ELSE slt.key
            END AS subscription_type,
            -- Add plan name for active trials
            CASE
                WHEN nd.active_plan_trial = 'BUSINESS_LARGE' THEN 'business'
                ELSE (
                    SELECT name
                    FROM licensing_pricing_plans lpp
                    LEFT JOIN licensing_user_subscriptions lus ON lus.subscription_plan_id = lpp.paddle_id
                    WHERE lus.user_id = nd.owner_id
                        AND lus.active IS TRUE
                    LIMIT 1
                )
            END AS plan_name,
            tm.id AS team_member_id,
            ad.alerts,
            -- Include plan trial fields from owner
            nd.active_plan_trial,
            nd.plan_trial_end_date,
            nd.trial_days_remaining,
            nd.trial_plan_display_name,
            CASE WHEN nd.active_plan_trial IS NOT NULL THEN TRUE ELSE FALSE END AS is_plan_trial,
            CASE
                WHEN nd.subscription_status = 'trialing' THEN nd.trial_expire_date::DATE
                WHEN nd.active_plan_trial IS NOT NULL THEN nd.plan_trial_end_date::DATE
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
            is_admin(nd.id, nd.active_team) AS is_admin,
            -- Add role_name for team lead checks
            (SELECT r.name 
             FROM team_members tm2
             JOIN roles r ON tm2.role_id = r.id
             WHERE tm2.user_id = nd.id AND tm2.team_id = nd.team_id AND tm2.active IS TRUE
             LIMIT 1) AS role_name
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

COMMENT ON FUNCTION deserialize_user IS 'Returns user session data including plan trial information and role_name for access control';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
