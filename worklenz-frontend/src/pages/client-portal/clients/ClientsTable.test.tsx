import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientPortalClient } from '@/api/client-portal/client-portal-api';
import {
  setLimit,
  setSearchFilter,
  setStatusFilter,
  clearFilters,
  toggleEditClientDrawer,
} from '@/features/clients-portal/clients/clients-slice';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  navigate: vi.fn(),
  refetch: vi.fn(),
  resendInvitation: vi.fn(),
  bulkDeactivate: vi.fn(),
  invalidateTags: vi.fn((tags: string[]) => ({ type: 'invalidateTags', payload: tags })),
  state: {
    clientsPortalReducer: {
      clientsReducer: {
        filters: { search: '', status: 'all', sortBy: 'name', sortOrder: 'asc' },
        pagination: { page: 1, limit: 10 },
      },
    },
    themeReducer: { mode: 'light' },
  } as Record<string, unknown>,
  query: {
    data: undefined as unknown,
    isFetching: false,
    error: undefined as unknown,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      const isSingular = options.count === 1;
      let value = String(
        (isSingular ? options.defaultValue_one : options.defaultValue_other) ??
          options.defaultValue ??
          key
      );
      Object.entries(options).forEach(([param, paramValue]) => {
        value = value.replace(`{{${param}}}`, String(paramValue));
      });
      return value;
    },
  }),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector(mocks.state),
}));

// The real helper pulls in the i18n bootstrap, which is irrelevant here.
vi.mock('@/utils/dateUtils', () => ({ fromNow: () => '2 hours ago' }));

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));

vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }),
}));

vi.mock('@/api/client-portal/client-portal-api', () => ({
  clientPortalApi: {
    util: { invalidateTags: mocks.invalidateTags, updateQueryData: vi.fn() },
  },
  useGetClientsQuery: () => ({ ...mocks.query, refetch: mocks.refetch }),
  useDeactivateClientMutation: () => [vi.fn()],
  useUpdateClientMutation: () => [vi.fn()],
  useBulkDeactivateClientsMutation: () => [mocks.bulkDeactivate],
  useGenerateClientInvitationLinkMutation: () => [vi.fn()],
  useResendClientInvitationMutation: () => [mocks.resendInvitation],
}));

import ClientsTable from './ClientsTable';

const buildClient = (overrides: Partial<ClientPortalClient> = {}): ClientPortalClient => ({
  id: 'client-1',
  name: 'Brandbase',
  email: 'alex@brandbase.com',
  company_name: 'Brandbase Ltd',
  phone: '+1 415 555 0142',
  contact_person: 'Alex Chen',
  assigned_projects_count: 4,
  projects: [],
  team_members: [],
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  has_portal_access: true,
  last_login_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  portal_status: { status: 'active', label: 'Active', color: 'green' },
  ...overrides,
});

const setClients = (clients: ClientPortalClient[], total = clients.length) => {
  mocks.query.data = { done: true, body: { clients, total, page: 1, limit: 10 } };
};

const setFilters = (filters: Partial<{ search: string; status: string }>) => {
  const reducer = mocks.state.clientsPortalReducer as {
    clientsReducer: { filters: Record<string, string> };
  };
  reducer.clientsReducer.filters = { ...reducer.clientsReducer.filters, ...filters };
};

describe('ClientsTable', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.dispatch.mockReset();
    mocks.navigate.mockReset();
    mocks.refetch.mockReset();
    mocks.resendInvitation.mockReset();
    mocks.bulkDeactivate.mockReset();
    mocks.query.data = undefined;
    mocks.query.isFetching = false;
    mocks.query.error = undefined;
    const reducer = mocks.state.clientsPortalReducer as {
      clientsReducer: {
        filters: Record<string, string>;
        pagination: { page: number; limit: number };
      };
    };
    reducer.clientsReducer.filters = { search: '', status: 'all', sortBy: 'name', sortOrder: 'asc' };
    reducer.clientsReducer.pagination = { page: 1, limit: 10 };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders each client with its portal status, contact and optional columns', () => {
    setClients([
      buildClient(),
      buildClient({
        id: 'client-2',
        name: 'Nexora Studio',
        email: 'hello@nexora.io',
        company_name: '',
        phone: '',
        contact_person: '',
        assigned_projects_count: 0,
        has_portal_access: false,
        last_login_at: null,
        invitation_sent_at: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000).toISOString(),
        portal_status: { status: 'expired', label: 'Expired', color: 'red' },
      }),
    ]);

    render(<ClientsTable />);

    const rows = screen.getAllByRole('row');
    const brandbase = within(rows.find(row => within(row).queryByText('Brandbase'))!);
    expect(brandbase.getByText('BR')).toBeInTheDocument();
    expect(brandbase.getByText('alex@brandbase.com')).toBeInTheDocument();
    expect(brandbase.getByText('Active')).toBeInTheDocument();
    expect(brandbase.getByText('+1 415 555 0142')).toBeInTheDocument();
    expect(brandbase.getByText('Alex Chen')).toBeInTheDocument();
    expect(brandbase.getByText('Brandbase Ltd')).toBeInTheDocument();
    expect(brandbase.getByText('4')).toBeInTheDocument();

    const nexora = within(rows.find(row => within(row).queryByText('Nexora Studio'))!);
    expect(nexora.getByText('Expired')).toBeInTheDocument();
    expect(nexora.getByText(/^Invited .*ago$/)).toBeInTheDocument();
  });

  it('hides a column from the Fields menu and remembers the choice', async () => {
    setClients([buildClient()]);

    const { unmount } = render(<ClientsTable />);
    expect(screen.getByRole('columnheader', { name: 'Phone' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fields/ }));
    // The menu animates open, which is slow when the whole suite runs in parallel.
    fireEvent.click(await screen.findByRole('menuitem', { name: /Phone/ }, { timeout: 5000 }));

    await waitFor(
      () => expect(screen.queryByRole('columnheader', { name: 'Phone' })).not.toBeInTheDocument(),
      { timeout: 5000 }
    );
    expect(screen.getByRole('columnheader', { name: 'POC' })).toBeInTheDocument();

    unmount();
    render(<ClientsTable />);
    expect(screen.queryByRole('columnheader', { name: 'Phone' })).not.toBeInTheDocument();
  }, 20000);

  it('dispatches the status filter, which the server applies before paging', () => {
    setClients([buildClient()]);

    render(<ClientsTable />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by status' }));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="Invited"]')!);

    expect(mocks.dispatch).toHaveBeenCalledWith(setStatusFilter('invited'));
  });

  it('waits for a pause in typing before searching', () => {
    vi.useFakeTimers();
    setClients([buildClient()]);

    render(<ClientsTable />);
    const search = screen.getByRole('searchbox');

    fireEvent.change(search, { target: { value: 'bra' } });
    fireEvent.change(search, { target: { value: 'brand' } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mocks.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: setSearchFilter.type }));

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith(setSearchFilter('brand'));
  });

  it('offers 5, 10 and 25 rows per page and resets through the page size change', async () => {
    setClients([buildClient()], 48);

    render(<ClientsTable />);
    expect(screen.getByText('Showing 1-10 of 48 clients')).toBeInTheDocument();

    const sizeChanger = screen.getByRole('combobox', { name: 'Rows per page:' });
    const labels = Array.from(sizeChanger.querySelectorAll('option')).map(
      option => option.textContent
    );
    expect(labels).toEqual(['5', '10', '25']);

    fireEvent.change(sizeChanger, { target: { value: '25' } });
    expect(mocks.dispatch).toHaveBeenCalledWith(setLimit(25));
  });

  describe('opening a client', () => {
    const openRowMenu = async (name: string) => {
      fireEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }));
      await screen.findByRole('menuitem', { name: /View Details/ });
    };

    it('opens the workspace when the row is clicked', () => {
      setClients([buildClient()]);
      render(<ClientsTable />);

      const row = screen.getAllByRole('row').find(item => within(item).queryByText('Brandbase'))!;
      fireEvent.click(row);

      expect(mocks.navigate).toHaveBeenCalledWith('/worklenz/client-portal/clients/client-1');
    });

    it('opens the workspace from the client name without also firing the row click', () => {
      setClients([buildClient()]);
      render(<ClientsTable />);

      fireEvent.click(screen.getByText('Brandbase'));

      expect(mocks.navigate).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).toHaveBeenCalledWith('/worklenz/client-portal/clients/client-1');
    });

    it('opens the workspace from View Details', async () => {
      setClients([buildClient()]);
      render(<ClientsTable />);

      await openRowMenu('Brandbase');
      fireEvent.click(screen.getByRole('menuitem', { name: /View Details/ }));

      expect(mocks.navigate).toHaveBeenCalledWith('/worklenz/client-portal/clients/client-1');
    });

    it('opens the Projects tab from Manage Projects', async () => {
      setClients([buildClient()]);
      render(<ClientsTable />);

      await openRowMenu('Brandbase');
      fireEvent.click(screen.getByRole('menuitem', { name: /Manage Projects/ }));

      expect(mocks.navigate).toHaveBeenCalledWith(
        '/worklenz/client-portal/clients/client-1?tab=projects'
      );
    });

    it('keeps Edit Client as a modal instead of leaving the list', async () => {
      setClients([buildClient()]);
      render(<ClientsTable />);

      await openRowMenu('Brandbase');
      fireEvent.click(screen.getByRole('menuitem', { name: /Edit Client/ }));

      expect(mocks.dispatch).toHaveBeenCalledWith(toggleEditClientDrawer('client-1'));
      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  });

  describe('POC column', () => {
    it('shows the first POC and how many more there are', () => {
      setClients([buildClient({ poc_names: ['Alex Chen', 'Jordan Lee', 'Morgan Diaz'] })]);

      render(<ClientsTable />);

      expect(screen.getByText('Alex Chen')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('shows a single POC without a count', () => {
      setClients([buildClient({ poc_names: ['Alex Chen'] })]);

      render(<ClientsTable />);

      expect(screen.getByText('Alex Chen')).toBeInTheDocument();
      // Only a bare "+N" is a POC count; the phone number also starts with a plus.
      expect(screen.queryByText(/^\s*\+\d+\s*$/)).not.toBeInTheDocument();
    });

    it('shows a dash for a company with no POC, which is valid', () => {
      setClients([buildClient({ poc_names: [], contact_person: '' })]);

      render(<ClientsTable />);

      const row = screen.getAllByRole('row').find(item => within(item).queryByText('Brandbase'))!;
      expect(within(row).queryByText('Alex Chen')).not.toBeInTheDocument();
    });
  });

  it('shows the add-client empty state when there are no clients at all', () => {
    setClients([]);

    render(<ClientsTable />);

    expect(screen.getByText('No Clients Found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add new/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clear Filters/ })).not.toBeInTheDocument();
  });

  it('offers to clear the filters when they leave no matches', () => {
    setFilters({ status: 'invited' });
    setClients([]);

    render(<ClientsTable />);

    expect(screen.getByText('No clients match the current filters.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Clear Filters/ })[0]);
    expect(mocks.dispatch).toHaveBeenCalledWith(clearFilters());
  });

  it('shows a retryable error state', () => {
    mocks.query.error = { status: 500 };

    render(<ClientsTable />);

    expect(screen.getByText('Error Loading Clients')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('invites only selected clients that can receive an invitation', async () => {
    setClients([
      buildClient({ id: 'active', name: 'Active Co' }),
      buildClient({
        id: 'not-invited',
        name: 'Fresh Co',
        has_portal_access: false,
        portal_status: { status: 'not_invited', label: 'Not Invited', color: 'default' },
      }),
      buildClient({
        id: 'no-email',
        name: 'Mailless Co',
        email: '',
        has_portal_access: false,
        portal_status: { status: 'not_invited', label: 'Not Invited', color: 'default' },
      }),
    ]);
    mocks.resendInvitation.mockReturnValue({
      unwrap: () => Promise.resolve({ body: { emailSent: true } }),
    });

    render(<ClientsTable />);

    const rows = screen.getAllByRole('row').slice(1);
    rows.forEach(row => fireEvent.click(within(row).getByRole('checkbox')));

    fireEvent.click(screen.getByRole('button', { name: /Bulk Actions/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Send Portal Invitations/ }));

    await waitFor(() => expect(mocks.resendInvitation).toHaveBeenCalledTimes(1));
    expect(mocks.resendInvitation).toHaveBeenCalledWith({ clientId: 'not-invited' });
  });

  it('asks for confirmation before deactivating the selected clients', async () => {
    setClients([buildClient()]);

    render(<ClientsTable />);
    fireEvent.click(within(screen.getAllByRole('row')[1]).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Bulk Actions/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Deactivate Selected/ }));

    expect(mocks.bulkDeactivate).not.toHaveBeenCalled();
    expect(await screen.findByText(/Deactivate the 1 selected client\?/)).toBeInTheDocument();
  });
});
