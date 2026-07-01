-- Migration: Backfill Business trials cancelled by the old AppSumo LTD redemption logic
-- Description: `plan-trial-controller.ts` used to call cancelPlanTrialByTier() for any
--              AppSumo LTD user, setting licensing_plan_trials.is_active = FALSE the
--              moment they redeemed a code (or even just polled trial status), cutting
--              their 14-day Business trial short. That call has been removed. This
--              reactivates only the trials it killed, and only if their original
--              trial_end_date (preserved on cancellation) hasn't already passed —
--              trials that expired naturally are left alone.
-- Date: 2026-07-01

UPDATE licensing_plan_trials
SET is_active = TRUE,
    cancellation_reason = NULL,
    updated_at = NOW()
WHERE is_active = FALSE
  AND cancellation_reason IN (
    'appsumo_ltd_business_unlocked',
    'appsumo_ltd_not_eligible_for_business_trial'
  )
  AND trial_end_date > NOW();
