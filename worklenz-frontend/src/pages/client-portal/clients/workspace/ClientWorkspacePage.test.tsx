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
  navigate: vi.fn(),
  dispatch: vi.fn(),
  overview: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
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

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'org-1' }),
  useNavigate: () => state.navigate,
  useLocation: () => ({ key: 'abc' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => state.dispatch }));
vi.mock('@/hooks/useMixpanelTracking', () => ({ useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }) }));
vi.mock('@/features/clients-portal/clients/clients-slice', () => ({
  openAddCompanyUserDrawer: (payload: unknown) => ({ type: 'openAddCompanyUserDrawer', payload }),
  toggleClientDetailsDrawer: (payload: unknown) => ({ type: 'toggleClientDetailsDrawer', payload }),
}));

// The tabs and header have their own tests and need data of their own; only the action menu is under test.
vi.mock('./OverviewTab', () => ({ OverviewTab: () => null }));
vi.mock('./UsersTab', () => ({ UsersTab: () => null }));
vi.mock('./ProjectsTab', () => ({ ProjectsTab: () => null }));
vi.mock('./ApprovalsTab', () => ({ ApprovalsTab: () => null }));
vi.mock('./ChangeRequestsTab', () => ({ ChangeRequestsTab: () => null }));
vi.mock('./BillingTab', () => ({ BillingTab: () => null }));
vi.mock('./ActivityTab', () => ({ ActivityTab: () => null }));
vi.mock('./WorkspaceHeader', () => ({ WorkspaceHeader: () => null }));
vi.mock('./WorkspaceRail', () => ({ WorkspaceRail: () => null }));
vi.mock('../../discussions/MessageClientModal', () => ({ MessageClientModal: () => null }));

vi.mock('@/api/client-portal/portal-access-api', () => ({
  useGetOrganizationOverviewQuery: () => state.overview,
  useDeactivatePortalOrganizationMutation: () => [trigger(state.deactivate), { isLoading: false }],
  useReactivatePortalOrganizationMutation: () => [trigger(state.reactivate), { isLoading: false }],
  useDeletePortalOrganizationMutation: () => [trigger(state.deleteOrganization), { isLoading: false }],
  useRestorePortalOrganizationMutation: () => [trigger(state.restore), { isLoading: false }],
  useGetOrganizationDeletePreviewQuery: (_id: string, options?: { skip?: boolean }) => ({
    data: options?.skip
      ? undefined
      : {
          body: {
            organization_id: 'org-1', name: 'Brandbase', status: 'active', active_users: 2, invited_users: 0,
            total_users: 2, portal_projects: 1, open_invoices: [], pending_approvals: [], open_change_requests: [],
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

import ClientWorkspacePage from './ClientWorkspacePage';
import { CLIENTS_PATH } from './workspace-helpers';

const overviewOf = (status: string) => ({
  body: {
    organization: {
      id: 'org-1', name: 'Brandbase', status, portal_access: status === 'inactive' ? 'deactivated' : 'active',
      active_users: 2, invited_users: 0, total_users: 2, portal_projects: 1, awaiting_client: 0,
    },
    stats: { portal_projects: 1, awaiting_client_action: 0, open_change_requests: 0 },
    needs_attention: [],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.overview = { data: overviewOf('active'), isLoading: false, isError: false, error: undefined, refetch: vi.fn() };
  state.deactivate.mockResolvedValue({ body: {} });
  state.reactivate.mockResolvedValue({ body: {} });
  state.deleteOrganization.mockResolvedValue({
    body: { organization_id: 'org-1', deleted_at: '2026-10-01T00:00:00.000Z', purge_on: '2026-10-31T00:00:00.000Z' },
  });
});

describe('ClientWorkspacePage "Client actions" menu', () => {
  it('offers Edit, Deactivate and a danger Delete for an active client', async () => {
    render(<ClientWorkspacePage />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));

    expect(await screen.findByText('Edit client')).toBeInTheDocument();
    expect(screen.getByText('Deactivate client')).toBeInTheDocument();
    expect(screen.getByText('Delete client').closest('li')).toHaveClass('ant-dropdown-menu-item-danger');
    expect(screen.queryByText('Reactivate client')).not.toBeInTheDocument();
  });

  it('offers Reactivate instead of Deactivate for a deactivated client', async () => {
    state.overview = { data: overviewOf('inactive'), isLoading: false, isError: false, error: undefined, refetch: vi.fn() };
    render(<ClientWorkspacePage />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));

    expect(await screen.findByText('Reactivate client')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate client')).not.toBeInTheDocument();
  });

  it('confirms a deactivation before calling the API', async () => {
    render(<ClientWorkspacePage />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    await userEvent.click(await screen.findByText('Deactivate client'));

    expect(await screen.findByText('Deactivate Brandbase?')).toBeInTheDocument();
    expect(state.deactivate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate client' }));
    await waitFor(() => expect(state.deactivate).toHaveBeenCalledWith('org-1'));
    // Deactivating keeps the workspace open: the client is still there.
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('leaves the workspace for the Clients list once the client is deleted', async () => {
    render(<ClientWorkspacePage />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    await userEvent.click(await screen.findByText('Delete client'));

    expect(await screen.findByText('Delete Brandbase?')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete client' }));

    await waitFor(() => expect(state.deleteOrganization).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith(CLIENTS_PATH, { replace: true }));
  });
});
