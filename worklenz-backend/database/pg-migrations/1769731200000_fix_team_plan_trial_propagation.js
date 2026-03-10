'use strict';
// Converted from: database/migrations/20260212000000-fix-team-plan-trial-propagation.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix team plan trial propagation to all team members
-- Description: Updates deserialize_user to propagate business plan trials from team owner to all team members
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
    -- Modified CTE for plan trial data - checks both user and team owner trials
    plan_trial_data AS (
        SELECT
            pt.id AS trial_id,
            pt.plan_tier_id,
            pt.trial_end_date AS plan_trial_end_date,
            pt.is_active,
            lpt.tier_name AS active_plan_trial,
            lpt.display_name AS trial_plan_display_name,
            GREATEST(0, EXTRACT(DAY FROM (pt.trial_end_date - NOW()))::INTEGER) AS trial_days_remaining
        FROM team_org_data tod
        LEFT JOIN licensing_plan_trials pt ON (
            -- First check if current user has an active trial
            (pt.user_id = tod.id AND pt.organization_id = tod.organization_id AND pt.is_active = TRUE AND pt.trial_end_date > NOW())
            OR
            -- If not, check if team owner has an active trial (propagate to team members)
            (pt.user_id = tod.owner_id AND pt.organization_id = tod.organization_id AND pt.is_active = TRUE AND pt.trial_end_date > NOW())
        )
        LEFT JOIN licensing_plan_tiers lpt ON lpt.id = pt.plan_tier_id
        LIMIT 1
    ),
    notification_data AS (
        SELECT
            tod.*,
            ptd.active_plan_trial,
            ptd.plan_trial_end_date,
            ptd.trial_days_remaining,
            ptd.trial_plan_display_name,
            COALESCE(ns.email_notifications_enabled, TRUE) AS email_notifications_enabled
        FROM team_org_data tod
        LEFT JOIN plan_trial_data ptd ON TRUE
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
            -- Modified subscription type logic to include plan trials
            CASE
                WHEN nd.active_plan_trial = 'BUSINESS_LARGE' THEN 'BUSINESS_TRIAL'
                WHEN nd.active_plan_trial = 'ENTERPRISE' THEN 'ENTERPRISE_TRIAL'
                WHEN nd.active_plan_trial IS NOT NULL THEN 'PLAN_TRIAL'
                ELSE slt.key
            END AS subscription_type,
            -- Add plan name for active trials
            CASE
                WHEN nd.active_plan_trial = 'BUSINESS_LARGE' THEN 'business'
                WHEN nd.active_plan_trial = 'ENTERPRISE' THEN 'enterprise'
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
            -- Include plan trial fields
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
