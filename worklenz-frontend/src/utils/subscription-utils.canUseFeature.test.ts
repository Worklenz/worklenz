import { describe, expect, it } from 'vitest';
import { canUseFeature } from './subscription-utils';
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
});
