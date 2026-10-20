import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import type { IPaddleBillingCheckoutResponse } from '@/types/admin-center/admin-center.types';

/**
 * Paddle Billing (Paddle.js v2) checkout. Paddle Classic checkout stays in usePaddleCheckout.
 *
 * The existing checkout flow (analytics, success/abandon/error handling) speaks the Classic event
 * shape ({ event: 'Checkout.Complete', checkout: { ... } }), so v2 events are adapted into it
 * instead of duplicating that flow.
 */

export interface ILegacyCheckoutEvent {
  event: 'Checkout.Loaded' | 'Checkout.Complete' | 'Checkout.Close' | 'Checkout.Error';
  checkout?: {
    recurring_prices?: Array<{ id: string }>;
    recurring_totals?: { total: number };
  };
  error?: { message?: string; code?: string };
}

interface IPaddleV2Event {
  name?: string;
  data?: {
    items?: Array<{ price_id?: string }>;
    totals?: { total?: number | string };
    error?: { detail?: string; code?: string; type?: string };
  } | null;
}

export const isPaddleBillingCheckout = (data: { provider?: string }): data is IPaddleBillingCheckoutResponse =>
  data.provider === 'paddle_billing';

/** Map a Paddle.js v2 event to the Classic event shape; null for events the flow does not use. */
export function adaptPaddleBillingEvent(event: IPaddleV2Event): ILegacyCheckoutEvent | null {
  switch (event.name) {
    case 'checkout.loaded':
      return { event: 'Checkout.Loaded' };
    case 'checkout.completed':
      return {
        event: 'Checkout.Complete',
        checkout: {
          recurring_prices: event.data?.items?.[0]?.price_id ? [{ id: event.data.items[0].price_id }] : [],
          recurring_totals: { total: Number(event.data?.totals?.total) || 0 },
        },
      };
    case 'checkout.closed':
      return { event: 'Checkout.Close' };
    case 'checkout.error':
    case 'checkout.failed':
      return {
        event: 'Checkout.Error',
        error: { message: event.data?.error?.detail, code: event.data?.error?.code },
      };
    default:
      return null;
  }
}

// Paddle.js is initialised once per page load. Initialising again would register a second event
// callback, so the callback delegates to whichever checkout is currently open.
let paddleInstance: Promise<Paddle | undefined> | null = null;
let activeHandler: ((event: ILegacyCheckoutEvent) => void) | null = null;

export async function openPaddleBillingCheckout(
  payload: IPaddleBillingCheckoutResponse,
  onEvent: (event: ILegacyCheckoutEvent) => void
): Promise<void> {
  activeHandler = onEvent;

  paddleInstance ??= initializePaddle({
    environment: payload.environment,
    token: payload.client_token,
    eventCallback: event => {
      const adapted = adaptPaddleBillingEvent(event as IPaddleV2Event);
      if (adapted) activeHandler?.(adapted);
    },
  }).catch(error => {
    paddleInstance = null; // allow a retry after a script load failure
    throw error;
  });

  const paddle = await paddleInstance;
  if (!paddle) {
    paddleInstance = null;
    throw new Error('Paddle.js failed to initialise');
  }

  paddle.Checkout.open({
    items: payload.items,
    customer: payload.customer,
    customData: payload.customData,
    settings: { displayMode: 'overlay', allowLogout: false, ...payload.settings },
  } as Parameters<Paddle['Checkout']['open']>[0]);
}
