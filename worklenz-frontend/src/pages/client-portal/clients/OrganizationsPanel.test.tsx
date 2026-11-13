import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  navigate: vi.fn(),
  dispatch: vi.fn(),
  orgsQuery: vi.fn(),
  orgsResult: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  deleteOrganization: vi.fn(),
  restore: vi.fn(),
  preview: { data: undefined as unknown, isError: false, isFetching: false },
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('react-router-dom', () => ({ useNavigate: () => state.navigate }));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => state.dispatch }));
vi.mock('@/features/clients-portal/clients/clients-slice', () => ({
  toggleClientDetailsDrawer: (id: string) => ({ type: 'toggleClientDetailsDrawer', payload: id }),
}));
vi.mock('../discussions/MessageClientModal', () => ({ MessageClientModal: () => null }));

vi.mock('@/api/client-portal/portal-access-api', () => ({
  useGetPortalOrganizationsQuery: (params: unknown) => {
    state.orgsQuery(params);
    return state.orgsResult;
  },
  useResendPortalInvitationMutation: () => [trigger(vi.fn()), { isLoading: false }],
  useDeactivatePortalOrganizationMutation: () => [trigger(state.deactivate), { isLoading: false }],
  useReactivatePortalOrganizationMutation: () => [trigger(state.reactivate), { isLoading: false }],
  useDeletePortalOrganizationMutation: () => [trigger(state.deleteOrganization), { isLoading: false }],
  useRestorePortalOrganizationMutation: () => [trigger(state.restore), { isLoading: false }],
  useGetOrganizationDeletePreviewQuery: (_id: string, options?: { skip?: boolean }) => ({
    ...state.preview,
    data: options?.skip ? undefined : state.preview.data,
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

import type { ClientOrganization } from '@/types/client-portal/v2';
import { OrganizationsPanel } from './OrganizationsPanel';

const makeOrganization = (overrides: Partial<ClientOrganization> = {}): ClientOrganization => ({
  id: 'org-1',
  name: 'Brandbase',
  initials: 'BB',
  color: '#1677ff',
  status: 'active',
  deleted_at: null,
  purge_on: null,
  primary_contact_id: 'c1',
  primary_contact_name: 'Alex Rivera',
  primary_contact_email: 'alex@brandbase.example',
  phone: null,
  outstanding: [],
  portal_access: 'active',
  active_users: 2,
  invited_users: 0,
  deactivated_users: 0,
  total_users: 2,
  portal_projects: 1,
  awaiting_client: 0,
  awaiting_approvals: 0,
  awaiting_change_requests: 0,
  ...overrides,
});

const listOf = (items: ClientOrganization[], deletedOrganizations = 0) => ({
  data: {
    body: {
      items,
      total: items.length,
      page: 1,
      limit: 10,
      stats: {
        organizations: items.length,
        deleted_organizations: deletedOrganizations,
        active_users: 0,
        invited_users: 0,
        expired_invites: 0,
        awaiting_client_action: 0,
      },
    },
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

const openRowMenu = async (name: string) => {
  const row = screen.getByText(name).closest('tr') as HTMLElement;
  await userEvent.click(within(row).getByRole('button', { name: `Actions for ${name}` }));
};

beforeEach(() => {
  vi.clearAllMocks();
  state.orgsResult = listOf([makeOrganization()]);
  state.preview = {
    data: {
      body: {
        organization_id: 'org-1', name: 'Brandbase', status: 'active', active_users: 2, invited_users: 0, total_users: 2,
        portal_projects: 1, open_invoices: [], pending_approvals: [], open_change_requests: [], retention_days: 30,
      },
    },
    isError: false,
    isFetching: false,
  };
  state.deactivate.mockResolvedValue({ body: {} });
  state.reactivate.mockResolvedValue({ body: {} });
  state.deleteOrganization.mockResolvedValue({
    body: { organization_id: 'org-1', deleted_at: '2026-10-01T00:00:00.000Z', purge_on: '2026-10-31T00:00:00.000Z' },
  });
  state.restore.mockResolvedValue({ body: {} });
});

describe('OrganizationsPanel row actions ("…" menu)', () => {
  it('offers Deactivate and Delete for an active client, after a divider, with Delete as the danger item', async () => {
    render(<OrganizationsPanel />);
    await openRowMenu('Brandbase');

    expect(await screen.findByText('Deactivate client')).toBeInTheDocument();
    const remove = screen.getByText('Delete client');
    expect(remove).toBeInTheDocument();
    expect(remove.closest('li')).toHaveClass('ant-dropdown-menu-item-danger');
    expect(screen.queryByText('Reactivate client')).not.toBeInTheDocument();
    // The existing items are still there.
    expect(screen.getByText('Edit client')).toBeInTheDocument();
  });

  it('offers Reactivate instead of Deactivate for a deactivated client', async () => {
    state.orgsResult = listOf([makeOrganization({ status: 'inactive', portal_access: 'deactivated' })]);
    render(<OrganizationsPanel />);
    await openRowMenu('Brandbase');

    expect(await screen.findByText('Reactivate client')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate client')).not.toBeInTheDocument();
    expect(screen.getByText('Delete client')).toBeInTheDocument();
  });

  it('deactivates only after the dialog is confirmed, without opening the workspace', async () => {
    render(<OrganizationsPanel />);
    await openRowMenu('Brandbase');
    await userEvent.click(await screen.findByText('Deactivate client'));

    expect(await screen.findByText('Deactivate Brandbase?')).toBeInTheDocument();
    expect(state.deactivate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate client' }));

    await waitFor(() => expect(state.deactivate).toHaveBeenCalledWith('org-1'));
    // A click in the menu or the dialog must not bubble to the row and open the client.
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('opens the Delete dialog from the menu and deletes after confirmation', async () => {
    render(<OrganizationsPanel />);
    await openRowMenu('Brandbase');
    await userEvent.click(await screen.findByText('Delete client'));

    expect(await screen.findByText('Delete Brandbase?')).toBeInTheDocument();
    expect(await screen.findByText('Users who lose access right away: 2')).toBeInTheDocument();
    expect(state.deleteOrganization).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete client' }));
    await waitFor(() => expect(state.deleteOrganization).toHaveBeenCalledTimes(1));
    expect(state.navigate).not.toHaveBeenCalled();
  });
});

describe('OrganizationsPanel Deleted view', () => {
  it('shows no Deleted button when nothing is waiting to be restored', () => {
    render(<OrganizationsPanel />);
    expect(screen.queryByRole('button', { name: /Deleted \(/ })).not.toBeInTheDocument();
  });

  it('opens a list of the deleted clients that can still be restored, with when they go for good', async () => {
    state.orgsResult = listOf([makeOrganization()], 2);
    const { rerender } = render(<OrganizationsPanel />);

    await userEvent.click(screen.getByRole('button', { name: /Deleted \(2\)/ }));
    expect(state.orgsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ deleted: true }));

    state.orgsResult = listOf(
      [
        makeOrganization({
          id: 'org-9',
          name: 'Old Co',
          deleted_at: '2026-10-01T10:00:00.000Z',
          purge_on: '2026-10-31T10:00:00.000Z',
        }),
      ],
      1
    );
    rerender(<OrganizationsPanel />);

    expect(screen.getByText(/A deleted client can be restored for 30 days/)).toBeInTheDocument();
    const row = screen.getByText('Old Co').closest('tr') as HTMLElement;
    expect(within(row).getByText('Oct 1, 2026')).toBeInTheDocument();
    expect(within(row).getByText('Oct 31, 2026')).toBeInTheDocument();
  });

  it('offers Restore, and nothing else, for a deleted client, and does not open it on click', async () => {
    state.orgsResult = listOf([makeOrganization()], 1);
    const { rerender } = render(<OrganizationsPanel />);
    await userEvent.click(screen.getByRole('button', { name: /Deleted \(1\)/ }));
    state.orgsResult = listOf(
      [makeOrganization({ id: 'org-9', name: 'Old Co', deleted_at: '2026-10-01T10:00:00.000Z', purge_on: '2026-10-31T10:00:00.000Z' })],
      1
    );
    rerender(<OrganizationsPanel />);

    await userEvent.click(screen.getByText('Old Co'));
    expect(state.navigate).not.toHaveBeenCalled();

    await openRowMenu('Old Co');
    expect(await screen.findByText('Restore client')).toBeInTheDocument();
    expect(screen.queryByText('Delete client')).not.toBeInTheDocument();
    expect(screen.queryByText('Deactivate client')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit client')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Restore client'));
    expect(await screen.findByText('Restore Old Co?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore client' }));
    await waitFor(() => expect(state.restore).toHaveBeenCalledWith({ organizationId: 'org-9', newName: undefined }));
  });

  it('goes back to the clients list', async () => {
    state.orgsResult = listOf([makeOrganization()], 1);
    render(<OrganizationsPanel />);
    await userEvent.click(screen.getByRole('button', { name: /Deleted \(1\)/ }));
    await userEvent.click(screen.getByRole('button', { name: /Back to clients/ }));
    expect(state.orgsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ deleted: undefined }));
  });
});
