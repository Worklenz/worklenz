/**
 * Migration: Fix get_billing_info cardinality violations
 * Date: 2026-03-18
 * Description: Ensures get_billing_info always returns a single row by selecting a single active subscription and aggregating custom subs.
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION get_billing_info(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _is_custom BOOLEAN := FALSE;
    _is_ltd    BOOLEAN := FALSE;
    _result    JSON;
BEGIN
    SELECT EXISTS(SELECT 1 FROM licensing_custom_subs WHERE user_id = _user_id) INTO _is_custom;
    SELECT EXISTS(SELECT 1 FROM licensing_coupon_codes WHERE redeemed_by = _user_id) INTO _is_ltd;

    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT (SELECT name FROM users WHERE ud.user_id = users.id) AS name,
                 (SELECT email FROM users WHERE ud.user_id = users.id) AS email,
                 ud.contact_number,
                 ud.contact_number_secondary,
                 ud.trial_in_progress,
                 ud.trial_expire_date,
                 lus.unit_price::NUMERIC,
                 lus.cancel_url,
                 ud.subscription_status AS status,
                 lus.cancellation_effective_date,
                 lus.paused_at,
                 lus.paused_from::DATE,
                 lus.paused_reason,
                 _is_custom AS is_custom,
                 _is_ltd AS is_ltd_user,
                 (SELECT SUM(team_members_limit) FROM licensing_coupon_codes WHERE redeemed_by = _user_id) AS ltd_users,
                 (SELECT COUNT(*)
                  FROM licensing_coupon_codes lcc
                  WHERE lcc.redeemed_by = _user_id
                    AND lcc.is_redeemed = TRUE
                    AND lcc.is_refunded = FALSE) AS redeemed_codes_count,
                 (CASE
                      WHEN (ud.business_plan_override = TRUE) THEN 'Business Plan'
                      WHEN (_is_custom) THEN 'Custom Plan'
                      WHEN (_is_ltd) THEN 'Life Time Deal'
                      ELSE
                              (SELECT name FROM licensing_pricing_plans WHERE id = lus.plan_id) END) AS plan_name,
                 (SELECT key FROM sys_license_types WHERE id = ud.license_type_id) AS subscription_type,
                 (SELECT id AS plan_id FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (SELECT default_currency AS default_currency FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (SELECT billing_type FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (CASE
                      WHEN ud.subscription_status = 'trialing' THEN ud.trial_expire_date::DATE
                      WHEN (_is_custom) THEN
                          (SELECT MAX(end_date)::DATE FROM licensing_custom_subs lcs WHERE lcs.user_id = ud.user_id)
                      WHEN lus.id IS NOT NULL THEN
                          (NULLIF(lus.next_bill_date, '')::DATE - INTERVAL '1 day')::DATE
                     END) AS valid_till_date,
                 ud.is_lkr_billing
          FROM (SELECT *
                FROM organizations
                WHERE user_id = _user_id
                ORDER BY created_at DESC NULLS LAST
                LIMIT 1) ud
                   LEFT JOIN LATERAL (SELECT *
                                      FROM licensing_user_subscriptions
                                      WHERE user_id = ud.user_id
                                        AND active = TRUE
                                        AND COALESCE(status, '') <> 'deleted'
                                      ORDER BY NULLIF(next_bill_date, '')::DATE DESC NULLS LAST
                                      LIMIT 1) lus ON TRUE) rec;
    RETURN _result;
END;
$$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION get_billing_info(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _is_custom BOOLEAN := FALSE;
    _is_ltd    BOOLEAN := FALSE;
    _result    JSON;
BEGIN
    SELECT EXISTS(SELECT id FROM licensing_custom_subs WHERE user_id = _user_id) INTO _is_custom;
    SELECT EXISTS(SELECT 1 FROM licensing_coupon_codes WHERE redeemed_by = _user_id) INTO _is_ltd;

    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT (SELECT name FROM users WHERE ud.user_id = users.id),
                 (SELECT email FROM users WHERE ud.user_id = users.id),
                 contact_number,
                 contact_number_secondary,
                 trial_in_progress,
                 trial_expire_date,
                 unit_price::NUMERIC,
                 cancel_url,
                 subscription_status AS status,
                 lus.cancellation_effective_date,
                 lus.paused_at,
                 lus.paused_from::DATE,
                 lus.paused_reason,
                 _is_custom AS is_custom,
                 _is_ltd AS is_ltd_user,
                 (SELECT SUM(team_members_limit) FROM licensing_coupon_codes WHERE redeemed_by = _user_id) AS ltd_users,
                 (SELECT COUNT(*)
                  FROM licensing_coupon_codes lcc
                  WHERE lcc.redeemed_by = _user_id
                    AND lcc.is_redeemed = TRUE
                    AND lcc.is_refunded = FALSE) AS redeemed_codes_count,
                 (CASE
                      WHEN (ud.business_plan_override = TRUE) THEN 'Business Plan'
                      WHEN (_is_custom) THEN 'Custom Plan'
                      WHEN (_is_ltd) THEN 'Life Time Deal'
                      ELSE
                              (SELECT name FROM licensing_pricing_plans WHERE id = lus.plan_id) END) AS plan_name,
                 (SELECT key FROM sys_license_types WHERE id = ud.license_type_id) AS subscription_type,
                 (SELECT id AS plan_id FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (SELECT default_currency AS default_currency FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (SELECT billing_type FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (CASE
                      WHEN ud.subscription_status = 'trialing' THEN ud.trial_expire_date::DATE
                      WHEN EXISTS (SELECT 1 FROM licensing_custom_subs lcs WHERE lcs.user_id = ud.user_id) THEN
                          (SELECT end_date FROM licensing_custom_subs lcs WHERE lcs.user_id = ud.user_id)::DATE
                      WHEN EXISTS (SELECT 1 FROM licensing_user_subscriptions lus WHERE lus.user_id = ud.user_id) THEN
                          (SELECT next_bill_date::DATE - INTERVAL '1 day'
                           FROM licensing_user_subscriptions lus
                           WHERE lus.user_id = ud.user_id)::DATE
                     END) AS valid_till_date,
                 is_lkr_billing
          FROM organizations ud
                   LEFT JOIN licensing_user_subscriptions lus ON ud.user_id = lus.user_id
          WHERE ud.user_id = _user_id) rec;
    RETURN _result;
END;
$$;
  `);
};

