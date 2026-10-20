import type { IPerUserPlan, PerUserPlanKey } from '@/api/admin-center/billing.api.service';

export type PricingFrequency = 'monthly' | 'annual';

export interface IPlanGroup {
  key: PerUserPlanKey;
  monthly?: IPerUserPlan;
  annual?: IPerUserPlan;
}

const PLAN_ORDER: PerUserPlanKey[] = ['pro', 'business', 'business_appsumo_expansion'];

/** Group the monthly and annual plans of each tier, in display order. */
export function groupPlans(plans: IPerUserPlan[]): IPlanGroup[] {
  return PLAN_ORDER.map(key => {
    const ofKey = plans.filter(plan => plan.plan_key === key);
    return {
      key,
      monthly: ofKey.find(plan => plan.billing_type === 'month'),
      annual: ofKey.find(plan => plan.billing_type === 'year'),
    };
  }).filter(group => group.monthly || group.annual);
}

export function pickPlan(group: IPlanGroup, frequency: PricingFrequency): IPerUserPlan | undefined {
  return frequency === 'annual' ? group.annual : group.monthly;
}

/** What one user costs per month: annual plans are priced per year. */
export function perUserMonthlyPrice(plan: IPerUserPlan): number {
  return plan.billing_type === 'year' ? plan.price / 12 : plan.price;
}

/** Amount charged each billing period for the given number of users. */
export function periodTotal(plan: IPerUserPlan, seats: number): number {
  return plan.price * Math.max(1, Math.floor(seats) || 1);
}

/** Saving of annual billing compared with paying monthly, as a whole percent. */
export function annualSavingsPercent(group: IPlanGroup): number | undefined {
  if (!group.monthly || !group.annual || group.monthly.price <= 0) return undefined;
  const percent = Math.round((1 - perUserMonthlyPrice(group.annual) / group.monthly.price) * 100);
  return percent > 0 ? percent : undefined;
}

export function formatUsd(amount: number): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
