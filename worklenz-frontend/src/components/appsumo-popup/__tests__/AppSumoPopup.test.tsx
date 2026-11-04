import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppSumoPopup } from '../AppSumoPopup';
import { MixpanelBillingEvents } from '@/types/mixpanel-events.types';

const { mockClaim, mockTrack, mockDispatch } = vi.hoisted(() => ({
  mockClaim: vi.fn(),
  mockTrack: vi.fn(),
  mockDispatch: vi.fn(),
}));

vi.mock('@/api/settings/profile/profile-settings.api.service', () => ({
  profileSettingsApiService: { claimAppSumoPopup: mockClaim },
}));

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: mockTrack }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/features/admin-center/admin-center.slice', () => ({
  openUpgradeModal: () => ({ type: 'adminCenter/openUpgradeModal' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const STORAGE_KEY = 'appsumo-popup-last-shown';
const CTA_LABEL = 'Upgrade to Business';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

const allowed = { done: true, body: { should_show: true } };
const suppressed = { done: true, body: { should_show: false } };

const flush = () => act(async () => {});

// jsdom does not implement getComputedStyle(elt, pseudoElt), which antd's Modal scroll lock calls
// and which would otherwise print a "Not implemented" error per render. Ignore the pseudo-element.
const realGetComputedStyle = window.getComputedStyle.bind(window);

describe('AppSumoPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'getComputedStyle').mockImplementation(elt => realGetComputedStyle(elt));
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    mockClaim.mockResolvedValue(allowed);
  });

  it('opens when the server allows it, stamps the local gate and tracks a view', async () => {
    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);

    expect(await screen.findByRole('button', { name: CTA_LABEL })).toBeInTheDocument();
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
    expect(mockTrack).toHaveBeenCalledWith(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_VIEWED, {
      source_component: 'AppSumoPopup',
      billing: 'annual',
    });
  });

  it('stays closed and writes nothing when the server says it was already shown', async () => {
    mockClaim.mockResolvedValue(suppressed);

    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);
    await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
    await flush();

    expect(screen.queryByRole('button', { name: CTA_LABEL })).not.toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('falls back to the local gate and opens when the claim request fails', async () => {
    mockClaim.mockRejectedValue(new Error('Network Error'));

    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);

    expect(await screen.findByRole('button', { name: CTA_LABEL })).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('falls back to the local gate and opens when the server answers done:false', async () => {
    mockClaim.mockResolvedValue({ done: false, body: null });

    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);

    expect(await screen.findByRole('button', { name: CTA_LABEL })).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('does not call the server when the local gate says it was shown recently', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(String(Date.now() - 60 * 60 * 1000));

    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);
    await flush();

    expect(mockClaim).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: CTA_LABEL })).not.toBeInTheDocument();
  });

  it('honours a legacy toDateString() stamp written before the epoch-ms format', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(new Date().toDateString());

    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);
    await flush();

    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('does nothing for users who are not eligible', async () => {
    render(<AppSumoPopup isAppSumoUser={false} frequencyDays={1} />);
    await flush();

    expect(mockClaim).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: CTA_LABEL })).not.toBeInTheDocument();
  });

  it('issues a single claim even when the effect re-runs while it is in flight', async () => {
    const pending = deferred<typeof allowed>();
    mockClaim.mockReturnValue(pending.promise);

    const { rerender } = render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);
    await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));

    rerender(<AppSumoPopup isAppSumoUser frequencyDays={2} />);
    await flush();
    await act(async () => pending.resolve(allowed));

    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: CTA_LABEL })).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('issues a single claim and opens once under React.StrictMode', async () => {
    render(
      <React.StrictMode>
        <AppSumoPopup isAppSumoUser frequencyDays={1} />
      </React.StrictMode>
    );

    expect(await screen.findByRole('button', { name: CTA_LABEL })).toBeInTheDocument();
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('does not open if eligibility is lost while the claim is in flight', async () => {
    const pending = deferred<typeof allowed>();
    mockClaim.mockReturnValue(pending.promise);

    const { rerender } = render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);
    await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));

    rerender(<AppSumoPopup isAppSumoUser={false} frequencyDays={1} />);
    await act(async () => pending.resolve(allowed));

    expect(screen.queryByRole('button', { name: CTA_LABEL })).not.toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('does not stamp localStorage or open if unmounted while the claim is in flight', async () => {
    const pending = deferred<typeof allowed>();
    mockClaim.mockReturnValue(pending.promise);

    const { unmount } = render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);
    await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => pending.resolve(allowed));

    expect(screen.queryByRole('button', { name: CTA_LABEL })).not.toBeInTheDocument();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('stamps only when it opens: closing tracks the event but does not write again', async () => {
    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);
    await screen.findByRole('button', { name: CTA_LABEL });
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss offer' }));

    expect(mockTrack).toHaveBeenCalledWith(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_CLOSED, {
      source_component: 'AppSumoPopup',
      billing: 'annual',
      action: 'cancel',
    });
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('clicking Upgrade opens the upgrade modal and tracks the click', async () => {
    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);

    fireEvent.click(await screen.findByRole('button', { name: CTA_LABEL }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'adminCenter/openUpgradeModal' });
    expect(mockTrack).toHaveBeenCalledWith(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_UPGRADE_CLICKED, {
      source_component: 'AppSumoPopup',
      billing: 'annual',
      price: 5,
      regular_price: 10,
    });
  });

  it('toggles billing period, reflects price, and tracks the toggle', async () => {
    render(<AppSumoPopup isAppSumoUser frequencyDays={1} />);
    await screen.findByRole('button', { name: CTA_LABEL });

    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledWith(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_BILLING_TOGGLED, {
      source_component: 'AppSumoPopup',
      billing: 'monthly',
      previous_billing: 'annual',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Annual' }));
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledWith(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_BILLING_TOGGLED, {
      source_component: 'AppSumoPopup',
      billing: 'annual',
      previous_billing: 'monthly',
    });
  });
});
