import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const dispatch = vi.fn();
let billingInfo: Record<string, unknown> = { total_used: 5 };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.returnObjects) return [`${key}.one`, `${key}.two`];
      return options && Object.keys(options).length ? `${key} ${JSON.stringify(options)}` : key;
    },
  }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ adminCenterReducer: { billingInfo } }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ setCurrentSession: vi.fn() }) }));
vi.mock('@/features/admin-center/admin-center.slice', () => ({
  fetchBillingInfo: () => ({ type: 'fetchBillingInfo' }),
  toggleUpgradeModal: () => ({ type: 'toggleUpgradeModal' }),
}));
vi.mock('@/features/user/userSlice', () => ({ setUser: (user: unknown) => ({ type: 'setUser', payload: user }) }));
vi.mock('@/utils/session-helper', () => ({ setSession: vi.fn() }));
vi.mock('@/utils/errorLogger', () => ({ default: { error: vi.fn() } }));
vi.mock('@/api/auth/auth.api.service', () => ({
  authApiService: { verify: vi.fn(async () => ({ authenticated: false })) },
}));

const changePlan = vi.fn();
vi.mock('@/api/admin-center/admin-center.api.service', () => ({ adminCenterApiService: { changePlan: (id: string) => changePlan(id) } }));

const upgradeToPaidPlan = vi.fn();
const getPerUserPlans = vi.fn();
vi.mock('@/ee/api/admin-center/billing.api.service', () => ({
  billingApiService: {
    upgradeToPaidPlan: (...args: unknown[]) => upgradeToPaidPlan(...args),
    getPerUserPlans: () => getPerUserPlans(),
  },
}));

const openPaddleBillingCheckout = vi.fn(async () => undefined);
vi.mock('@/ee/utils/paddle-billing-checkout', () => ({
  isPaddleBillingCheckout: (data: { provider?: string }) => data.provider === 'paddle_billing',
  openPaddleBillingCheckout: (...args: unknown[]) => openPaddleBillingCheckout(...(args as [])),
}));

vi.mock('@/ee/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans', () => ({
  default: () => <div>legacy-upgrade-plans</div>,
}));

import PerUserUpgradePlans from './PerUserUpgradePlans';
import UpgradePlansSwitch from './UpgradePlansSwitch';
import type { IPerUserPlansResponse } from '@/ee/api/admin-center/billing.api.service';

const plans: IPerUserPlansResponse['plans'] = [
  { id: 'pro-m', name: 'Pro monthly', plan_key: 'pro', billing_type: 'month', price: 8 },
  { id: 'pro-y', name: 'Pro annual', plan_key: 'pro', billing_type: 'year', price: 72 },
  { id: 'biz-m', name: 'Business monthly', plan_key: 'business', billing_type: 'month', price: 12 },
  { id: 'biz-y', name: 'Business annual', plan_key: 'business', billing_type: 'year', price: 120 },
];

const data = (overrides: Partial<IPerUserPlansResponse> = {}): IPerUserPlansResponse => ({
  plans,
  has_ltd_codes: false,
  has_legacy_subscription: false,
  has_billing_subscription: false,
  ...overrides,
});

const checkoutPayload = { provider: 'paddle_billing', client_token: 't', items: [], customer: { email: 'a@b.com' }, customData: {} };

beforeEach(() => {
  vi.clearAllMocks();
  billingInfo = { total_used: 5 };
  upgradeToPaidPlan.mockResolvedValue({ done: true, body: checkoutPayload });
});

describe('PerUserUpgradePlans', () => {
  it('shows one price per user per month, and the yearly price spread over twelve months', async () => {
    const user = userEvent.setup();
    render(<PerUserUpgradePlans data={data()} />);

    expect(screen.getByText('$8')).toBeTruthy();
    expect(screen.getByText('$12')).toBeTruthy();

    await user.click(screen.getByText('annual'));
    expect(screen.getByText('$6')).toBeTruthy();
    expect(screen.getByText('$10')).toBeTruthy();
    expect(screen.getAllByText(/billedAnnually/).length).toBe(2);
  });

  it('starts checkout for the selected plan with the active user count as seats', async () => {
    const user = userEvent.setup();
    render(<PerUserUpgradePlans data={data()} />);

    await user.click(screen.getAllByText('select')[0]);

    await waitFor(() => expect(openPaddleBillingCheckout).toHaveBeenCalledTimes(1));
    expect(upgradeToPaidPlan).toHaveBeenCalledWith('pro-m', 'per_user', 5, false);
    expect((openPaddleBillingCheckout.mock.calls[0] as unknown[])[0]).toBe(checkoutPayload);
  });

  it('uses the annual plan when annual billing is selected', async () => {
    const user = userEvent.setup();
    render(<PerUserUpgradePlans data={data()} />);

    await user.click(screen.getByText('annual'));
    await user.click(screen.getAllByText('select')[1]);

    await waitFor(() => expect(upgradeToPaidPlan).toHaveBeenCalledWith('biz-y', 'per_user', 5, false));
  });

  it('asks before replacing a legacy subscription, and records the consent', async () => {
    const user = userEvent.setup();
    render(<PerUserUpgradePlans data={data({ has_legacy_subscription: true })} />);

    await user.click(screen.getAllByText('select')[0]);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(document.querySelectorAll('.ant-modal-confirm-title').length).toBe(1); // opened once
    expect(upgradeToPaidPlan).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'legacyConfirm.ok' }));
    await waitFor(() => expect(upgradeToPaidPlan).toHaveBeenCalledWith('pro-m', 'per_user', 5, true));
  });

  it('does not start checkout when the legacy confirmation is declined', async () => {
    const user = userEvent.setup();
    render(<PerUserUpgradePlans data={data({ has_legacy_subscription: true })} />);

    await user.click(screen.getAllByText('select')[0]);
    await user.click(await screen.findByRole('button', { name: 'legacyConfirm.cancel' }));

    expect(upgradeToPaidPlan).not.toHaveBeenCalled();
    expect(openPaddleBillingCheckout).not.toHaveBeenCalled();
  });

  it('changes plan in place for an existing Paddle Billing subscriber', async () => {
    const user = userEvent.setup();
    changePlan.mockResolvedValue({ done: true });
    render(<PerUserUpgradePlans data={data({ has_billing_subscription: true })} />);

    await user.click(screen.getAllByText('switch')[1]);

    await waitFor(() => expect(changePlan).toHaveBeenCalledWith('biz-m'));
    expect(upgradeToPaidPlan).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: 'fetchBillingInfo' });
  });

  it('disables the current plan', () => {
    billingInfo = { total_used: 5, plan_id: 'pro-m' };
    render(<PerUserUpgradePlans data={data({ has_billing_subscription: true })} />);

    expect(screen.getByText('currentPlan')).toBeTruthy();
    expect((screen.getAllByText('switch')[0].closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByText('switch')[1].closest('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the AppSumo Expansion plan with its own seat count', async () => {
    const user = userEvent.setup();
    const expansion = { id: 'exp-m', name: 'Expansion', plan_key: 'business_appsumo_expansion' as const, billing_type: 'month' as const, price: 6 };
    render(<PerUserUpgradePlans data={data({ plans: [...plans, expansion], has_ltd_codes: true })} />);

    expect(screen.getByText('plans.expansion.name')).toBeTruthy();
    expect(screen.getByText('$6')).toBeTruthy();

    await user.click(screen.getAllByText('select')[2]);
    await waitFor(() => expect(upgradeToPaidPlan).toHaveBeenCalledWith('exp-m', 'per_user', 1, false));
  });

  it('reports a failed checkout without throwing', async () => {
    const user = userEvent.setup();
    upgradeToPaidPlan.mockResolvedValue({ done: false, message: 'nope' });
    render(<PerUserUpgradePlans data={data()} />);

    await user.click(screen.getAllByText('select')[0]);

    await waitFor(() => expect(upgradeToPaidPlan).toHaveBeenCalled());
    expect(openPaddleBillingCheckout).not.toHaveBeenCalled();
  });
});

describe('UpgradePlansSwitch', () => {
  it('shows the per-user plans once any are active', async () => {
    getPerUserPlans.mockResolvedValue({ done: true, body: data() });
    render(<UpgradePlansSwitch />);
    expect(await screen.findByText('title')).toBeTruthy();
    expect(screen.queryByText('legacy-upgrade-plans')).toBeNull();
  });

  it('keeps the legacy plans while none are active', async () => {
    getPerUserPlans.mockResolvedValue({ done: true, body: data({ plans: [] }) });
    render(<UpgradePlansSwitch />);
    expect(await screen.findByText('legacy-upgrade-plans')).toBeTruthy();
  });

  it('falls back to the legacy plans if the per-user plans cannot be loaded', async () => {
    getPerUserPlans.mockRejectedValue(new Error('network'));
    render(<UpgradePlansSwitch />);
    expect(await screen.findByText('legacy-upgrade-plans')).toBeTruthy();
  });
});
