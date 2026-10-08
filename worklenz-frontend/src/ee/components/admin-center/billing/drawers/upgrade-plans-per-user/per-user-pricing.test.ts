import { describe, expect, it } from 'vitest';
import type { IPerUserPlan } from '@/ee/api/admin-center/billing.api.service';
import {
  annualSavingsPercent,
  formatUsd,
  groupPlans,
  perUserMonthlyPrice,
  periodTotal,
  pickPlan,
} from './per-user-pricing';

const plan = (plan_key: IPerUserPlan['plan_key'], billing_type: IPerUserPlan['billing_type'], price: number): IPerUserPlan => ({
  id: `${plan_key}-${billing_type}`,
  name: `${plan_key} ${billing_type}`,
  plan_key,
  billing_type,
  price,
});

const plans = [
  plan('business', 'year', 120),
  plan('pro', 'month', 8),
  plan('business', 'month', 12),
  plan('pro', 'year', 72),
  plan('business_appsumo_expansion', 'month', 6),
];

describe('groupPlans', () => {
  it('orders tiers Pro, Business, Expansion and pairs monthly with annual', () => {
    const groups = groupPlans(plans);
    expect(groups.map(group => group.key)).toEqual(['pro', 'business', 'business_appsumo_expansion']);
    expect(groups[0].monthly?.price).toBe(8);
    expect(groups[0].annual?.price).toBe(72);
    expect(groups[2].annual).toBeUndefined();
  });

  it('omits tiers with no plans', () => {
    expect(groupPlans([plan('pro', 'month', 8)]).map(group => group.key)).toEqual(['pro']);
    expect(groupPlans([])).toEqual([]);
  });
});

describe('prices', () => {
  const [pro, business] = groupPlans(plans);

  it('picks the plan for the billing frequency', () => {
    expect(pickPlan(pro, 'monthly')?.price).toBe(8);
    expect(pickPlan(pro, 'annual')?.price).toBe(72);
  });

  it('shows annual plans as a per-month price per user', () => {
    expect(perUserMonthlyPrice(pro.monthly!)).toBe(8);
    expect(perUserMonthlyPrice(pro.annual!)).toBe(6);
    expect(perUserMonthlyPrice(business.annual!)).toBe(10);
  });

  it('totals the amount charged each billing period', () => {
    expect(periodTotal(pro.monthly!, 5)).toBe(40);
    expect(periodTotal(pro.annual!, 5)).toBe(360);
    expect(periodTotal(pro.monthly!, 0)).toBe(8);
  });

  it('computes annual savings', () => {
    expect(annualSavingsPercent(pro)).toBe(25);
    expect(annualSavingsPercent(business)).toBe(17);
    expect(annualSavingsPercent({ key: 'pro', monthly: pro.monthly })).toBeUndefined();
  });
});

describe('formatUsd', () => {
  it('drops cents for whole amounts only', () => {
    expect(formatUsd(8)).toBe('$8');
    expect(formatUsd(6.5)).toBe('$6.50');
    expect(formatUsd(1234)).toBe('$1,234');
  });
});
