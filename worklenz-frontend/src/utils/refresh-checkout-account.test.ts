import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshCheckoutAccount } from './refresh-checkout-account';

afterEach(() => vi.useRealTimers());

describe('refreshCheckoutAccount', () => {
  it('refreshes immediately and stops when the webhook data is available', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const pending = refreshCheckoutAccount(refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    await pending;
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps retrying late webhook data with a bounded retry count', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(false);
    const pending = refreshCheckoutAccount(refresh);
    await vi.runAllTimersAsync();
    await pending;
    expect(refresh).toHaveBeenCalledTimes(6);
  });
});
