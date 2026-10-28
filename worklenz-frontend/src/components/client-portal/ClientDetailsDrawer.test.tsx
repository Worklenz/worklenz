import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? '').replace(/{{(\w+)}}/g, (_match, name: string) =>
        String(options?.[name] ?? '')
      ),
    i18n: { language: 'en' },
  }),
}));

const state = vi.hoisted(() => ({
  dispatch: vi.fn(),
  fetchDetails: vi.fn(),
  details: { data: undefined as unknown, error: undefined as unknown },
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  deleteOrganization: vi.fn(),
  restore: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => state.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      clientsPortalReducer: { clientsReducer: { isClientDetailsDrawerOpen: true, selectedClientId: 'org-1' } },
    }),
}));
vi.mock('@/features/clients-portal/clients/clients-slice', () => ({
  toggleClientDetailsDrawer: (payload: unknown) => ({ type: 'toggleClientDetailsDrawer', payload }),
}));
vi.mock('@/components/PhoneInput/PhoneInput', () => ({ default: () => <input aria-label="phone" /> }));

vi.mock('@/api/client-portal/client-portal-api', async importOriginal => ({
  ...(await importOriginal<typeof import('@/api/client-portal/client-portal-api')>()),
  useLazyGetClientDetailsQuery: () => [
    state.fetchDetails,
    { data: state.details.data, isLoading: false, error: state.details.error, reset: vi.fn() },
  ],
  useUpdateClientMutation: () => [trigger(vi.fn()), { isLoading: false }],
}));

vi.mock('@/api/client-portal/portal-access-api', () => ({
  useDeactivatePortalOrganizationMutation: () => [trigger(state.deactivate), { isLoading: false }],
  useReactivatePortalOrganizationMutation: () => [trigger(state.reactivate), { isLoading: false }],
  useDeletePortalOrganizationMutation: () => [trigger(state.deleteOrganization), { isLoading: false }],
  useRestorePortalOrganizationMutation: () => [trigger(state.restore), { isLoading: false }],
  useGetOrganizationDeletePreviewQuery: (_id: string, options?: { skip?: boolean }) => ({
    data: options?.skip
      ? undefined
      : {
          body: {
            organization_id: 'org-1', name: 'Brandbase', status: 'active', active_users: 1, invited_users: 0,
            total_users: 1, portal_projects: 0, open_invoices: [], pending_approvals: [], open_change_requests: [],
            retention_days: 30,
          },
        },
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: { success: state.messageSuccess, error: state.messageError, warning: vi.fn(), info: vi.fn() },
  };
});

import ClientDetailsDrawer from './ClientDetailsDrawer';

const detailsOf = (status: string) => ({
  body: {
    id: 'org-1',
    name: 'brandbase-internal',
    company_name: 'Brandbase',
    email: 'hello@brandbase.example',
    status,
    phone: '',
    phone_country_code: 'US',
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.details = { data: detailsOf('active'), error: undefined };
  state.deactivate.mockResolvedValue({ body: {} });
  state.reactivate.mockResolvedValue({ body: {} });
  state.deleteOrganization.mockResolvedValue({
    body: { organization_id: 'org-1', deleted_at: '2026-10-01T00:00:00.000Z', purge_on: '2026-10-31T00:00:00.000Z' },
  });
});

const openMenu = async () => userEvent.click(await screen.findByRole('button', { name: 'Client actions' }));

describe('ClientDetailsDrawer "…" menu', () => {
  it('offers Deactivate and Delete for an active client', async () => {
    render(<ClientDetailsDrawer />);
    await openMenu();

    expect(await screen.findByText('Deactivate client')).toBeInTheDocument();
    expect(screen.getByText('Delete client').closest('li')).toHaveClass('ant-dropdown-menu-item-danger');
    expect(screen.queryByText('Reactivate client')).not.toBeInTheDocument();
  });

  it('offers Reactivate instead of Deactivate for an inactive client', async () => {
    state.details = { data: detailsOf('inactive'), error: undefined };
    render(<ClientDetailsDrawer />);
    await openMenu();

    expect(await screen.findByText('Reactivate client')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate client')).not.toBeInTheDocument();
    expect(screen.getByText('Delete client')).toBeInTheDocument();
  });

  it('no longer deactivates at once: it names the effect and waits for the confirmation', async () => {
    render(<ClientDetailsDrawer />);
    await openMenu();
    await userEvent.click(await screen.findByText('Deactivate client'));

    // The dialog uses the company name the client list shows, not the internal record name.
    expect(await screen.findByText('Deactivate Brandbase?')).toBeInTheDocument();
    expect(state.deactivate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate client' }));
    await waitFor(() => expect(state.deactivate).toHaveBeenCalledWith('org-1'));
  });

  it('can delete the client, and closes the details modal once it is gone', async () => {
    render(<ClientDetailsDrawer />);
    await openMenu();
    await userEvent.click(await screen.findByText('Delete client'));

    expect(await screen.findByText('Delete Brandbase?')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete client' }));

    await waitFor(() => expect(state.deleteOrganization).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(state.dispatch).toHaveBeenCalledWith({ type: 'toggleClientDetailsDrawer', payload: null })
    );
  });
});
