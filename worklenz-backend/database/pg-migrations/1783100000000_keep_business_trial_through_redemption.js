'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Keep Business trial active through plan redemption until trial expiry
-- Description: Previously, redeeming an AppSumo LTD code (with < 5 codes) during an
--              active Business trial caused deserialize_user() to hide the trial from
--              the session immediately, cutting the 14-day trial short. This reverts
--              that exclusion so the trial keeps running for its full duration
--              regardless of plan redemption, and adds post_trial_plan_name so the
--              UI can show "Business until [date], then [plan]" while on trial.
--              Based on the current production deserialize_user() (with
--              mobile_app_banner_dismissed, language, and licensing_custom_subs
--              support) — only the plan_trial_data filter and the new
--              post_trial_plan_name field are changed.
-- Date: 2026-07-01

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
      u.mobile_app_banner_dismissed,
      (is_null_or_empty(u.google_id) IS FALSE) AS is_google,
      COALESCE(u.active_team, (SELECT id FROM teams WHERE user_id = u.id LIMIT 1)) AS team_id,
      u.active_team,
      u.language
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
  -- AppSumo entitlement lookup is a private, unpublished feature (see
  -- database/pg-migrations-private/20260821010000_restore_appsumo_in_deserialize_user.js,
  -- which overlays this function with the real query in the full/private build only).
  -- This always resolves to "not an AppSumo user", correct for every public-schema account.
  appsumo_data AS (
    SELECT
      tod.owner_id,
      FALSE AS is_ltd,
      0 AS redeemed_codes_count,
      FALSE AS appsumo_business_eligible
    FROM team_org_data tod
  ),
  plan_trial_data AS (
    -- NOTE: previously excluded the BUSINESS_LARGE trial row for AppSumo LTD users
    -- with < 5 redeemed codes. That exclusion cut the 14-day trial short as soon as
    -- a code was redeemed. The trial is now selected unconditionally; entitlement
    -- checks that must run after the trial ends already key off trial_end_date.
    SELECT
      pt.id AS trial_id,
      pt.plan_tier_id,
      pt.trial_end_date AS plan_trial_end_date,
      pt.is_active,
      lpt.tier_name AS active_plan_trial,
      lpt.display_name AS trial_plan_display_name,
      GREATEST(0, EXTRACT(DAY FROM (pt.trial_end_date - NOW()))::INTEGER) AS trial_days_remaining
    FROM team_org_data tod
    LEFT JOIN licensing_plan_trials pt
      ON pt.user_id = tod.owner_id
      AND pt.organization_id = tod.organization_id
      AND pt.is_active = TRUE
      AND pt.trial_end_date > NOW()
    LEFT JOIN licensing_plan_tiers lpt ON lpt.id = pt.plan_tier_id
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
      ad.is_ltd,
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
        WHEN (nd.appsumo_business_eligible = TRUE) THEN 'Business Plan'
        WHEN EXISTS(
          SELECT 1
          FROM licensing_custom_subs lcs
          WHERE lcs.user_id = nd.owner_id
            AND lcs.status IN ('active', 'pending')
        ) THEN (
          SELECT lpp.display_name
          FROM licensing_custom_subs lcs
          JOIN licensing_custom_plan_pricing lpp ON lpp.id = lcs.plan_tier_id
          WHERE lcs.user_id = nd.owner_id
            AND lcs.status IN ('active', 'pending')
          ORDER BY lcs.created_at DESC
          LIMIT 1
        )
        ELSE (
          SELECT name
          FROM licensing_pricing_plans lpp
          LEFT JOIN licensing_user_subscriptions lus ON lus.subscription_plan_id = lpp.paddle_id
          WHERE lus.user_id = nd.owner_id AND lus.active IS TRUE
          LIMIT 1
        )
      END AS plan_name,
      -- What the user's plan will resolve to once the active trial ends. Only
      -- populated while a trial is active; used by the billing UI to show
      -- "Business until [date], then [plan]". Mirrors the non-trial branches of
      -- the plan_name CASE above, without the trial override.
      CASE
        WHEN nd.active_plan_trial IS NULL THEN NULL
        WHEN nd.appsumo_business_eligible = TRUE THEN 'Business Plan'
        WHEN EXISTS(
          SELECT 1
          FROM licensing_custom_subs lcs
          WHERE lcs.user_id = nd.owner_id
            AND lcs.status IN ('active', 'pending')
        ) THEN (
          SELECT lpp.display_name
          FROM licensing_custom_subs lcs
          JOIN licensing_custom_plan_pricing lpp ON lpp.id = lcs.plan_tier_id
          WHERE lcs.user_id = nd.owner_id
            AND lcs.status IN ('active', 'pending')
          ORDER BY lcs.created_at DESC
          LIMIT 1
        )
        WHEN EXISTS(
          SELECT 1
          FROM licensing_pricing_plans lpp
          LEFT JOIN licensing_user_subscriptions lus ON lus.subscription_plan_id = lpp.paddle_id
          WHERE lus.user_id = nd.owner_id AND lus.active IS TRUE
        ) THEN (
          SELECT name
          FROM licensing_pricing_plans lpp
          LEFT JOIN licensing_user_subscriptions lus ON lus.subscription_plan_id = lpp.paddle_id
          WHERE lus.user_id = nd.owner_id AND lus.active IS TRUE
          LIMIT 1
        )
        WHEN nd.is_ltd THEN 'AppSumo LTD'
        ELSE NULL
      END AS post_trial_plan_name,
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
        WHEN EXISTS(
          SELECT 1
          FROM licensing_custom_subs
          WHERE user_id = nd.owner_id
            AND status IN ('active', 'pending')
        ) THEN (
          SELECT COALESCE(end_date, next_billing_date)
          FROM licensing_custom_subs
          WHERE user_id = nd.owner_id
            AND status IN ('active', 'pending')
          ORDER BY created_at DESC
          LIMIT 1
        )::DATE
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

COMMENT ON FUNCTION deserialize_user(uuid) IS 'Returns user session data including plan trial information, override flags, AppSumo LTD eligibility fields, LKR/DirectPay subscription details, and post-trial plan resolution. Business trials are no longer cut short by plan redemption.';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // DDL/function change — no automatic rollback defined.
};
