import { beforeEach, describe, expect, it, vi } from 'vitest';

const open = vi.fn();
let capturedOptions: { eventCallback?: (event: unknown) => void; token?: string; environment?: string } | undefined;
const initializePaddle = vi.fn(async (options: typeof capturedOptions) => {
  capturedOptions = options;
  return { Checkout: { open } };
});

vi.mock('@paddle/paddle-js', () => ({ initializePaddle: (options: typeof capturedOptions) => initializePaddle(options) }));

import {
  adaptPaddleBillingEvent,
  isPaddleBillingCheckout,
  openPaddleBillingCheckout,
} from './paddle-billing-checkout';
import type { IPaddleBillingCheckoutResponse } from '@/types/admin-center/admin-center.types';

const payload: IPaddleBillingCheckoutResponse = {
  provider: 'paddle_billing',
  environment: 'sandbox',
  sandbox: true,
  client_token: 'test_token',
  items: [{ priceId: 'pri_pro_m', quantity: 4 }],
  customer: { email: 'a@b.com', address: { countryCode: 'LK' } },
  customData: { owner_id: 'owner-1' },
};

describe('adaptPaddleBillingEvent', () => {
  it('maps the events the checkout flow uses', () => {
    expect(adaptPaddleBillingEvent({ name: 'checkout.loaded' })).toEqual({ event: 'Checkout.Loaded' });
    expect(adaptPaddleBillingEvent({ name: 'checkout.closed' })).toEqual({ event: 'Checkout.Close' });
  });

  it('carries the price and total of a completed checkout', () => {
    expect(
      adaptPaddleBillingEvent({
        name: 'checkout.completed',
        data: { items: [{ price_id: 'pri_pro_m' }], totals: { total: 32 } },
      })
    ).toEqual({
      event: 'Checkout.Complete',
      checkout: { recurring_prices: [{ id: 'pri_pro_m' }], recurring_totals: { total: 32 } },
    });
  });

  it('copes with a completed checkout that has no item or total data', () => {
    expect(adaptPaddleBillingEvent({ name: 'checkout.completed' })).toEqual({
      event: 'Checkout.Complete',
      checkout: { recurring_prices: [], recurring_totals: { total: 0 } },
    });
  });

  it('maps errors with their detail', () => {
    expect(
      adaptPaddleBillingEvent({ name: 'checkout.error', data: { error: { detail: 'Card declined', code: 'declined' } } })
    ).toEqual({ event: 'Checkout.Error', error: { message: 'Card declined', code: 'declined' } });
  });

  it('ignores other events', () => {
    expect(adaptPaddleBillingEvent({ name: 'checkout.customer.created' })).toBeNull();
    expect(adaptPaddleBillingEvent({})).toBeNull();
  });
});

describe('isPaddleBillingCheckout', () => {
  it('only matches the Billing provider', () => {
    expect(isPaddleBillingCheckout(payload)).toBe(true);
    expect(isPaddleBillingCheckout({ provider: 'paddle_classic' })).toBe(false);
    expect(isPaddleBillingCheckout({})).toBe(false);
  });
});

describe('openPaddleBillingCheckout', () => {
  beforeEach(() => {
    open.mockClear();
    initializePaddle.mockClear();
  });

  it('opens an overlay checkout with the payload and forwards adapted events', async () => {
    const onEvent = vi.fn();
    await openPaddleBillingCheckout(payload, onEvent);

    expect(initializePaddle).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toMatchObject({ environment: 'sandbox', token: 'test_token' });
    expect(open).toHaveBeenCalledWith({
      items: payload.items,
      customer: payload.customer,
      customData: payload.customData,
      settings: { displayMode: 'overlay', allowLogout: false },
    });

    capturedOptions?.eventCallback?.({ name: 'checkout.closed' });
    capturedOptions?.eventCallback?.({ name: 'something.else' });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ event: 'Checkout.Close' });
  });

  it('initialises Paddle.js once and routes events to the checkout that is open', async () => {
    const first = vi.fn();
    const second = vi.fn();
    await openPaddleBillingCheckout(payload, first);
    await openPaddleBillingCheckout(payload, second);

    expect(initializePaddle).not.toHaveBeenCalled(); // already initialised by the previous test
    expect(open).toHaveBeenCalledTimes(2);

    capturedOptions?.eventCallback?.({ name: 'checkout.closed' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
