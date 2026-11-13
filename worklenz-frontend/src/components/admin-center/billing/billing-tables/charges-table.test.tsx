import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

let billingInfo = {};
const getCharges = vi.fn();
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: () => billingInfo,
}));
vi.mock('@/api/admin-center/admin-center.api.service', () => ({
  adminCenterApiService: { getCharges: () => getCharges() },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));

import ChargesTable, { formatBillingDate } from './charges-table';

describe('billing charge dates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never renders missing dates as the Unix epoch', () => {
    expect(formatBillingDate(null)).toBe('—');
    expect(formatBillingDate(undefined)).toBe('—');
    expect(formatBillingDate('')).toBe('—');
    expect(formatBillingDate('invalid')).toBe('—');
    expect(formatBillingDate('2026-11-02')).toBe('Nov 02, 2026');
  });

  it('reloads charges when checkout refreshes billing information', async () => {
    getCharges.mockResolvedValueOnce({ done: true, body: { plan_charges: [] } });
    const view = render(<ChargesTable />);
    await waitFor(() => expect(getCharges).toHaveBeenCalledTimes(1));
    getCharges.mockResolvedValueOnce({
      done: true,
      body: {
        plan_charges: [
          {
            id: 'charge-1',
            name: 'Pro',
            start_date: '2026-11-02',
            end_date: '2026-12-01',
          },
        ],
      },
    });
    billingInfo = { plan_id: 'pro-m' };
    view.rerender(<ChargesTable />);
    expect(await screen.findByText('Nov 02, 2026 - Dec 01, 2026')).toBeTruthy();
    expect(getCharges).toHaveBeenCalledTimes(2);
  });
});
