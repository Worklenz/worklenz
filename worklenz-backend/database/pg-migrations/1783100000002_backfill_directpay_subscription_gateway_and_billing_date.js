'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Backfill payment_gateway_id / next_billing_date on DirectPay subscriptions
-- Description: activateLkrSubscription() (billing-controller.ts) creates/extends
--              licensing_custom_subs rows for DirectPay (LKR) subscribers but never
--              set payment_gateway_id or next_billing_date. The license-manager
--              backend's recurring billing cron (BillingCycleService.processBillingCycle)
--              only selects rows WHERE payment_gateway_id = 'directpay' AND
--              next_billing_date <= CURRENT_DATE, so every subscription created through
--              the normal DirectPay checkout flow was silently invisible to that cron —
--              the first charge succeeded but no renewal was ever attempted. This
--              backfills the two columns for existing LKR/DirectPay subscriptions so
--              the cron can pick them up; the controller fix (same release) sets them
--              going forward.
-- Date: 2026-07-01

UPDATE licensing_custom_subs
SET payment_gateway_id = (SELECT id FROM licensing_payment_gateways WHERE name = 'directpay'),
    next_billing_date = COALESCE(next_billing_date, end_date)
WHERE currency = 'LKR'
  AND status IN ('active', 'pending', 'past_due')
  AND payment_gateway_id IS NULL
  AND EXISTS (SELECT 1 FROM licensing_directpay_cards ldc WHERE ldc.id = licensing_custom_subs.card_id);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Data backfill — no automatic rollback defined.
};
