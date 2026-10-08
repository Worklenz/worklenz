'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Paddle Billing (v2) support alongside Paddle Classic.
 *
 * Classic keys everything on integers (licensing_pricing_plans.paddle_id,
 * licensing_user_subscriptions.subscription_id / subscription_plan_id). Paddle Billing uses string
 * IDs (pri_..., sub_..., ctm_...), so Billing data lives in new columns next to the Classic ones and
 * no Classic row or query changes. Existing rows default to billing_provider = 'paddle_classic'.
 *
 * deserialize_user() is the only function that joined plans through the Classic integer ids
 * (lus.subscription_plan_id = lpp.paddle_id); it is patched in place so Billing subscriptions
 * resolve their plan through plan_id. get_billing_info() and checkTeamSubscriptionStatus() already
 * join on plan_id.
 */

const PATCHED_JOIN =
  "ON ((lus.billing_provider = 'paddle_billing' AND lus.plan_id = lpp.id) OR " +
  "(lus.billing_provider <> 'paddle_billing' AND lus.subscription_plan_id = lpp.paddle_id))";

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE licensing_pricing_plans
  ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'paddle_classic',
  ADD COLUMN IF NOT EXISTS paddle_price_id  TEXT,
  ADD COLUMN IF NOT EXISTS plan_key         TEXT,
  ADD COLUMN IF NOT EXISTS is_legacy        BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE licensing_pricing_plans
  DROP CONSTRAINT IF EXISTS licensing_pricing_plans_billing_provider_allowed;
ALTER TABLE licensing_pricing_plans
  ADD CONSTRAINT licensing_pricing_plans_billing_provider_allowed
    CHECK (billing_provider IN ('paddle_classic', 'paddle_billing'));

CREATE UNIQUE INDEX IF NOT EXISTS licensing_pricing_plans_paddle_price_id_uindex
  ON licensing_pricing_plans (paddle_price_id) WHERE paddle_price_id IS NOT NULL;

COMMENT ON COLUMN licensing_pricing_plans.paddle_price_id IS 'Paddle Billing price id (pri_...). NULL for Classic plans, which use paddle_id.';
COMMENT ON COLUMN licensing_pricing_plans.plan_key IS 'Entitlement tier for the plan: pro | business | business_appsumo_expansion.';
COMMENT ON COLUMN licensing_pricing_plans.is_legacy IS 'Plan is no longer sold. Existing subscribers keep it (active stays TRUE so plan and seat changes keep working).';

ALTER TABLE licensing_user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider              TEXT NOT NULL DEFAULT 'paddle_classic',
  ADD COLUMN IF NOT EXISTS paddle_billing_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_billing_customer_id    TEXT,
  ADD COLUMN IF NOT EXISTS paddle_billing_price_id       TEXT;

ALTER TABLE licensing_user_subscriptions
  DROP CONSTRAINT IF EXISTS licensing_user_subscriptions_billing_provider_allowed;
ALTER TABLE licensing_user_subscriptions
  ADD CONSTRAINT licensing_user_subscriptions_billing_provider_allowed
    CHECK (billing_provider IN ('paddle_classic', 'paddle_billing'));

CREATE UNIQUE INDEX IF NOT EXISTS licensing_user_subscriptions_paddle_billing_sub_uindex
  ON licensing_user_subscriptions (paddle_billing_subscription_id) WHERE paddle_billing_subscription_id IS NOT NULL;

COMMENT ON COLUMN licensing_user_subscriptions.paddle_billing_subscription_id IS 'Paddle Billing subscription id (sub_...). Classic subscriptions use the integer subscription_id.';
  `);

  // Patch deserialize_user in place rather than re-declaring ~300 lines of its body here.
  pgm.sql(`
DO $migration$
DECLARE
  _def   TEXT;
  _count INT;
BEGIN
  SELECT pg_get_functiondef('deserialize_user(uuid)'::regprocedure) INTO _def;

  SELECT COUNT(*) INTO _count
  FROM regexp_matches(_def, 'ON\\s+lus\\.subscription_plan_id\\s*=\\s*lpp\\.paddle_id', 'g');

  IF _count = 0 THEN
    RAISE EXCEPTION 'deserialize_user(uuid) no longer joins lus.subscription_plan_id = lpp.paddle_id; review this migration before applying';
  END IF;

  _def := regexp_replace(
    _def,
    'ON\\s+lus\\.subscription_plan_id\\s*=\\s*lpp\\.paddle_id',
    $patch$${PATCHED_JOIN}$patch$,
    'g'
  );

  EXECUTE _def;
END
$migration$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
DO $migration$
DECLARE
  _def TEXT;
BEGIN
  SELECT pg_get_functiondef('deserialize_user(uuid)'::regprocedure) INTO _def;
  _def := replace(
    _def,
    $patch$${PATCHED_JOIN}$patch$,
    'ON lus.subscription_plan_id = lpp.paddle_id'
  );
  EXECUTE _def;
END
$migration$;

DROP INDEX IF EXISTS licensing_user_subscriptions_paddle_billing_sub_uindex;
ALTER TABLE licensing_user_subscriptions
  DROP CONSTRAINT IF EXISTS licensing_user_subscriptions_billing_provider_allowed,
  DROP COLUMN IF EXISTS paddle_billing_price_id,
  DROP COLUMN IF EXISTS paddle_billing_customer_id,
  DROP COLUMN IF EXISTS paddle_billing_subscription_id,
  DROP COLUMN IF EXISTS billing_provider;

DROP INDEX IF EXISTS licensing_pricing_plans_paddle_price_id_uindex;
ALTER TABLE licensing_pricing_plans
  DROP CONSTRAINT IF EXISTS licensing_pricing_plans_billing_provider_allowed,
  DROP COLUMN IF EXISTS is_legacy,
  DROP COLUMN IF EXISTS plan_key,
  DROP COLUMN IF EXISTS paddle_price_id,
  DROP COLUMN IF EXISTS billing_provider;
  `);
};
