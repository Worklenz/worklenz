import { describe, expect, it } from 'vitest';
import { canUseFeature, hasReachedSeatLimit } from './subscription-utils';
import type { ILocalSession } from '@/types/auth/local-session.types';

const session = (overrides: Partial<ILocalSession>) => overrides as ILocalSession;

describe('canUseFeature', () => {
  it('denies without a session', () => {
    expect(canUseFeature(null, 'client_portal')).toBe(false);
  });

  it('legacy mode: Business features follow the Business check, others are open', () => {
    const business = session({ subscription_type: 'PADDLE', plan_name: 'Business Plan' });
    const pro = session({ subscription_type: 'PADDLE', plan_name: 'Pro' });

    expect(canUseFeature(business, 'finance_module')).toBe(true);
    expect(canUseFeature(pro, 'finance_module')).toBe(false);
    expect(canUseFeature(pro, 'planner_schedule')).toBe(false);
    expect(canUseFeature(pro, 'project_phases')).toBe(true);
  });

  it('AppSumo Business can use advanced_reporting; AppSumo Pro cannot', () => {
    const appsumoBusiness = session({
      subscription_type: 'LIFE_TIME_DEAL',
      redeemed_codes_count: 5,
      appsumo_business_eligible: true,
      plan_name: 'Business Plan',
    });
    const appsumoPro = session({
      subscription_type: 'LIFE_TIME_DEAL',
      redeemed_codes_count: 2,
      appsumo_business_eligible: false,
    });

    expect(canUseFeature(appsumoBusiness, 'advanced_reporting')).toBe(true);
    expect(canUseFeature(appsumoPro, 'advanced_reporting')).toBe(false);
  });

  it('enforced mode: follows the resolved feature list', () => {
    const ltd = session({
      subscription_type: 'LIFE_TIME_DEAL',
      entitlements: {
        tier: 'pro',
        features: ['planner_timeline', 'planner_workload'],
        guest_limit: 5,
        seat_limit: 5,
        primary_source: 'appsumo_ltd',
        enforced: true,
      },
    });

    expect(canUseFeature(ltd, 'planner_workload')).toBe(true);
    expect(canUseFeature(ltd, 'planner_schedule')).toBe(false);
    expect(canUseFeature(ltd, 'finance_module')).toBe(false);
  });

  it('client portal follows the resolved features even when the backend is not enforcing', () => {
    const entitlements = (features: string[]) => ({
      tier: 'pro' as const,
      features,
      guest_limit: -1,
      seat_limit: 5,
      primary_source: 'paddle_classic',
      enforced: false,
    });
    const pro = session({
      subscription_type: 'PADDLE',
      plan_name: 'Pro',
      entitlements: entitlements(['client_portal', 'client_portal_invoices']),
    });
    const free = session({ subscription_type: 'FREE', entitlements: entitlements([]) });

    expect(canUseFeature(pro, 'client_portal')).toBe(true);
    expect(canUseFeature(pro, 'client_portal_invoices')).toBe(true);
    expect(canUseFeature(pro, 'client_portal_branding')).toBe(false);
    expect(canUseFeature(free, 'client_portal')).toBe(false);
  });

  it('ignores the feature list when the backend is not enforcing', () => {
    const pro = session({
      subscription_type: 'PADDLE',
      plan_name: 'Pro',
      entitlements: {
        tier: 'business',
        features: ['finance_module'],
        guest_limit: -1,
        seat_limit: -1,
        primary_source: 'paddle_billing',
        enforced: false,
      },
    });
    expect(canUseFeature(pro, 'finance_module')).toBe(false);
  });

  it('uses the caller legacy rule only while the backend is not enforcing', () => {
    const legacy = () => true;
    const free = session({ subscription_type: 'FREE' });
    expect(canUseFeature(free, 'recurring_tasks', legacy)).toBe(true);

    const enforced = session({
      subscription_type: 'FREE',
      entitlements: {
        tier: 'free',
        features: [],
        guest_limit: 0,
        seat_limit: 5,
        primary_source: 'free',
        enforced: true,
      },
    });
    expect(canUseFeature(enforced, 'recurring_tasks', legacy)).toBe(false);
  });
});

describe('hasReachedSeatLimit', () => {
  const business = session({ subscription_type: 'PADDLE', plan_name: 'Business Plan' });
  const pro = session({ subscription_type: 'PADDLE', plan_name: 'Pro' });

  it('is false until every seat is used, or when seats are unknown', () => {
    expect(hasReachedSeatLimit(pro, { total_used: 4, total_seats: 5 })).toBe(false);
    expect(hasReachedSeatLimit(pro, { total_used: 5, total_seats: 0 })).toBe(false);
  });

  it('blocks non-Business plans at the limit; legacy Business is left to the backend', () => {
    expect(hasReachedSeatLimit(pro, { total_used: 5, total_seats: 5 })).toBe(true);
    expect(hasReachedSeatLimit(business, { total_used: 5, total_seats: 5 })).toBe(false);
  });

  it('blocks per-user Business plans too: the purchased seats are the cap', () => {
    expect(
      hasReachedSeatLimit(business, { total_used: 5, total_seats: 5, billing_provider: 'paddle_billing' })
    ).toBe(true);
  });
});
