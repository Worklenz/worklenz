'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: AppSumo LTD - disable Business trial (<5 codes) and expose redeemed_codes_count/appsumo_business_eligible in session
-- Date: 2026-03-16

CREATE OR REPLACE FUNCTION deserialize_user(_id uuid) RETURNS json
  LANGUAGE plpgsql
AS
$$
DECLARE
  _result JSON;
BEGIN
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
      o.id AS organization_id,
      o.business_plan_override,
      o.team_member_limit_override
    FROM user_team_data utd
    INNER JOIN teams t ON t.id = utd.team_id
    LEFT JOIN organizations o ON o.user_id = t.user_id
  ),
  appsumo_data AS (
    SELECT
      tod.owner_id,
      EXISTS(
        SELECT 1
        FROM licensing_coupon_codes lcc
        WHERE lcc.redeemed_by = tod.owner_id
          AND lcc.is_redeemed = TRUE
          AND lcc.is_refunded = FALSE
      ) AS is_ltd,
      (
        SELECT COUNT(*)::INT
        FROM licensing_coupon_codes lcc
        WHERE lcc.redeemed_by = tod.owner_id
          AND lcc.is_redeemed = TRUE
          AND lcc.is_refunded = FALSE
      ) AS redeemed_codes_count,
      (
        SELECT CASE
          WHEN (
            SELECT COUNT(*)::INT
            FROM licensing_coupon_codes lcc
            WHERE lcc.redeemed_by = tod.owner_id
              AND lcc.is_redeemed = TRUE
              AND lcc.is_refunded = FALSE
          ) >= 5 THEN TRUE
          ELSE FALSE
        END
      ) AS appsumo_business_eligible
    FROM team_org_data tod
  ),
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
    LEFT JOIN appsumo_data ad ON TRUE
    LEFT JOIN licensing_plan_trials pt
      ON pt.user_id = tod.owner_id
      AND pt.organization_id = tod.organization_id
      AND pt.is_active = TRUE
      AND pt.trial_end_date > NOW()
    LEFT JOIN licensing_plan_tiers lpt ON lpt.id = pt.plan_tier_id
    WHERE
      pt.id IS NULL
      OR NOT (
        ad.is_ltd = TRUE
        AND COALESCE(ad.redeemed_codes_count, 0) < 5
        AND lpt.tier_name = 'BUSINESS_LARGE'
      )
    ORDER BY pt.trial_end_date DESC
    LIMIT 1
  ),
  notification_data AS (
    SELECT
      tod.*,
      ptd.active_plan_trial,
      ptd.plan_trial_end_date,
      ptd.trial_days_remaining,
      ptd.trial_plan_display_name,
      ad.redeemed_codes_count,
      (ad.is_ltd AND ad.appsumo_business_eligible) AS appsumo_business_eligible,
      COALESCE(ns.email_notifications_enabled, TRUE) AS email_notifications_enabled
    FROM team_org_data tod
    LEFT JOIN plan_trial_data ptd ON TRUE
    LEFT JOIN appsumo_data ad ON TRUE
    LEFT JOIN notification_settings ns ON (ns.user_id = tod.id AND ns.team_id = tod.team_id)
  ),
  alerts_data AS (
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(alert_rec))), '[]'::JSON) AS alerts
    FROM (
      SELECT description, type
      FROM worklenz_alerts
      WHERE active IS TRUE
    ) alert_rec
  ),
  complete_user_data AS (
    SELECT
      nd.*,
      tz.name AS timezone_name,
      (SELECT r.name FROM roles r WHERE r.id = tm.role_id) AS role_name,
      CASE
        WHEN nd.active_plan_trial = 'BUSINESS_LARGE' THEN 'BUSINESS_TRIAL'
        WHEN nd.active_plan_trial = 'ENTERPRISE' THEN 'ENTERPRISE_TRIAL'
        WHEN nd.active_plan_trial IS NOT NULL THEN 'PLAN_TRIAL'
        ELSE slt.key
      END AS subscription_type,
      CASE
        WHEN nd.active_plan_trial = 'BUSINESS_LARGE' THEN 'business'
        WHEN nd.active_plan_trial = 'ENTERPRISE' THEN 'enterprise'
        ELSE (
          SELECT name
          FROM licensing_pricing_plans lpp
          LEFT JOIN licensing_user_subscriptions lus ON lus.subscription_plan_id = lpp.paddle_id
          WHERE lus.user_id = nd.owner_id AND lus.active IS TRUE
          LIMIT 1
        )
      END AS plan_name,
      tm.id AS team_member_id,
      ad.alerts,
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
          THEN (
            SELECT (next_bill_date)::DATE - INTERVAL '1 day'
            FROM licensing_user_subscriptions
            WHERE user_id = nd.owner_id AND active IS TRUE
            LIMIT 1
          )::DATE
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

  INSERT INTO notification_settings (user_id, team_id, email_notifications_enabled, popup_notifications_enabled, show_unread_items_count)
  SELECT
    _id,
    COALESCE((SELECT active_team FROM users WHERE id = _id),
             (SELECT id FROM teams WHERE user_id = _id LIMIT 1)),
    TRUE, TRUE, TRUE
  ON CONFLICT (user_id, team_id) DO NOTHING;

  RETURN _result;
END
$$;

COMMENT ON FUNCTION deserialize_user(uuid) IS 'Returns user session data including plan trial information, override flags, and AppSumo LTD eligibility fields';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // DDL/function change — no automatic rollback defined.
};

