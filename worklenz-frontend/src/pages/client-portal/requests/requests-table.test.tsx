import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setSelectedRequestNo } from '../../../features/clients-portal/requests/requests-slice';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  navigate: vi.fn(),
  refetch: vi.fn(),
  updateStatus: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  deleteRequest: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  createCustomStatus: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  deleteCustomStatus: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  customStatusesQuery: {
    data: { body: [] } as unknown,
    isLoading: false,
  },
  state: {
    clientsPortalReducer: {
      requestsReducer: {
        filters: { search: '', status: 'all', sortBy: 'created_at', sortOrder: 'desc' },
        pagination: { page: 1, limit: 10 },
      },
    },
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
      let value = String(options.defaultValue ?? key);
      Object.entries(options).forEach(([param, paramValue]) => {
        value = value.replace(`{{${param}}}`, String(paramValue));
      });
      return value;
    },
  }),
}));

vi.mock('../../../hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('../../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector(mocks.state),
}));

vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../../api/client-portal/client-portal-api', () => ({
  useGetOrganizationRequestsQuery: () => ({ ...mocks.query, refetch: mocks.refetch }),
  useUpdateOrganizationRequestStatusMutation: () => [mocks.updateStatus, { isLoading: false }],
  useDeleteOrganizationRequestMutation: () => [mocks.deleteRequest],
  useGetRequestCustomStatusesQuery: () => mocks.customStatusesQuery,
  useCreateRequestCustomStatusMutation: () => [mocks.createCustomStatus, { isLoading: false }],
  useDeleteRequestCustomStatusMutation: () => [mocks.deleteCustomStatus],
}));

import RequestsTable from './requests-table';

const buildRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  req_no: 'REQ-0001',
  service_id: 'service-1',
  service_name: 'Landing Page Design',
  client_id: 'client-1',
  client_name: 'TechFlow Inc',
  status: 'pending',
  notes: 'Needs a full redesign',
  request_data: { title: 'Need to design website' },
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const setRequests = (requests: ReturnType<typeof buildRequest>[], total = requests.length) => {
  mocks.query.data = { body: { data: requests, total } };
};

const setFilters = (filters: Partial<{ search: string; status: string }>) => {
  const reducer = mocks.state.clientsPortalReducer as {
    requestsReducer: { filters: Record<string, string> };
  };
  reducer.requestsReducer.filters = { ...reducer.requestsReducer.filters, ...filters };
};

const renderTable = () =>
  render(
    <MemoryRouter>
      <RequestsTable />
    </MemoryRouter>
  );

// Menu items pair an icon with a label; the icon's own accessible name gets folded into the
// computed name, so callers must match on a substring/regex rather than the exact label text.
const openRowMenu = async (reqNo: string) => {
  fireEvent.click(screen.getByRole('button', { name: `Actions for ${reqNo}` }));
  await screen.findByRole('menuitem', { name: /View/ });
};

describe('RequestsTable', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.dispatch.mockReset();
    mocks.navigate.mockReset();
    mocks.refetch.mockReset();
    mocks.updateStatus.mockClear();
    mocks.deleteRequest.mockClear();
    mocks.createCustomStatus.mockClear();
    mocks.deleteCustomStatus.mockClear();
    mocks.customStatusesQuery.data = { body: [] };
    mocks.customStatusesQuery.isLoading = false;
    mocks.query.data = undefined;
    mocks.query.isFetching = false;
    mocks.query.error = undefined;
    mocks.state.clientsPortalReducer = {
      requestsReducer: {
        filters: { search: '', status: 'all', sortBy: 'created_at', sortOrder: 'desc' },
        pagination: { page: 1, limit: 10 },
      },
    };
  });

  it('renders the Notes column, falling back to a dash when empty', () => {
    setRequests([buildRequest({ notes: '' })]);
    renderTable();

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('updates status inline from the table and keeps the mutation scoped to that row', () => {
    setRequests([buildRequest()]);
    renderTable();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status for REQ-0001' }));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="accepted"]')!);

    expect(mocks.updateStatus).toHaveBeenCalledWith({ id: 'req-1', status: 'accepted' });
  });

  it('navigates to the request from View', async () => {
    setRequests([buildRequest()]);
    renderTable();

    await openRowMenu('REQ-0001');
    fireEvent.click(screen.getByRole('menuitem', { name: /View/ }));

    expect(mocks.dispatch).toHaveBeenCalledWith(setSelectedRequestNo('REQ-0001'));
    expect(mocks.navigate).toHaveBeenCalledWith('/worklenz/client-portal/requests/req-1');
  });

  it('shows Convert to Project as a coming-soon stub with no navigation', async () => {
    setRequests([buildRequest()]);
    renderTable();

    await openRowMenu('REQ-0001');
    fireEvent.click(screen.getByRole('menuitem', { name: /Convert to Project/ }));

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(await screen.findByText('Convert to Project is coming soon.')).toBeInTheDocument();
  });

  it('disables Create Quote for a pending request', async () => {
    setRequests([buildRequest({ status: 'pending' })]);
    renderTable();

    await openRowMenu('REQ-0001');

    expect(screen.getByRole('menuitem', { name: /Create Quote/ })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('enables Create Quote once a request is accepted, navigating to the quote builder', async () => {
    setRequests([buildRequest({ status: 'accepted' })]);
    renderTable();

    await openRowMenu('REQ-0001');
    fireEvent.click(screen.getByRole('menuitem', { name: /Create Quote/ }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/worklenz/client-portal/quotes/create?requestId=req-1'
    );
  });

  it('disables Create Invoice for a pending request', async () => {
    setRequests([buildRequest({ status: 'pending' })]);
    renderTable();

    await openRowMenu('REQ-0001');

    expect(screen.getByRole('menuitem', { name: /Create Invoice/ })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('enables Create Invoice once a request is accepted, navigating to the invoice builder', async () => {
    setRequests([buildRequest({ status: 'accepted' })]);
    renderTable();

    await openRowMenu('REQ-0001');
    fireEvent.click(screen.getByRole('menuitem', { name: /Create Invoice/ }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/worklenz/client-portal/invoices/create?requestId=req-1'
    );
  });

  it('asks for confirmation before deleting a request', async () => {
    setRequests([buildRequest()]);
    renderTable();

    await openRowMenu('REQ-0001');
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

    expect(mocks.deleteRequest).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Are you sure you want to delete this request? This cannot be undone.')
    ).toBeInTheDocument();

    // Dismiss via antd's own Cancel handling, rather than leaving this Modal.confirm mounted
    // to document.body (outside the tree RTL unmounts) for later tests to trip over.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  describe('toolbar', () => {
    it('debounces search input before dispatching the filter', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      setRequests([buildRequest()]);
      renderTable();

      fireEvent.change(screen.getByPlaceholderText('Search requests, clients or services...'), {
        target: { value: 'techflow' },
      });

      expect(mocks.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: expect.stringContaining('setSearchFilter') })
      );

      vi.advanceTimersByTime(300);
      await vi.waitFor(() => expect(mocks.dispatch).toHaveBeenCalled());

      const dispatched = mocks.dispatch.mock.calls.map(([action]) => action);
      expect(dispatched).toContainEqual(expect.objectContaining({ payload: 'techflow' }));
      vi.useRealTimers();
    });

    it('shows Clear Filters only when a filter is active, and clears both on click', () => {
      setFilters({ status: 'accepted' });
      setRequests([buildRequest({ status: 'accepted' })]);
      renderTable();

      fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

      const dispatched = mocks.dispatch.mock.calls.map(([action]) => action.type);
      expect(dispatched).toContain('requestsReducer/clearFilters');
    });

    it('hides Clear Filters when no filter is active', () => {
      setRequests([buildRequest()]);
      renderTable();

      expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument();
    });

    it('dispatches the status filter from the toolbar select', () => {
      setRequests([buildRequest()]);
      renderTable();

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by status' }));
      fireEvent.click(document.querySelector('.ant-select-item-option[title="accepted"]')!);

      expect(mocks.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'requestsReducer/setStatusFilter', payload: 'accepted' })
      );
    });
  });

  describe('more options menu', () => {
    const openMoreOptions = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'More options' }));
      await screen.findByRole('menuitem', { name: /Configure Services/ });
    };

    it('navigates to Services from the gear menu', async () => {
      setRequests([buildRequest()]);
      renderTable();

      await openMoreOptions();
      fireEvent.click(screen.getByRole('menuitem', { name: /Configure Services/ }));

      expect(mocks.navigate).toHaveBeenCalledWith('/worklenz/client-portal/services');
    });

    it('opens the Add Custom Status modal from the gear menu', async () => {
      setRequests([buildRequest()]);
      renderTable();

      await openMoreOptions();
      fireEvent.click(screen.getByRole('menuitem', { name: /Add Custom Status/ }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Add Custom Status')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('sorts by client on the Client column header', () => {
      setRequests([buildRequest()]);
      renderTable();

      // The mocked t() returns the raw key when no defaultValue is passed (real i18n has
      // "clientColumn": "Client"), so the rendered header text here is the key itself. antd
      // also renders a hidden "measure" copy of the header for column-width calculation, so
      // pick the one that's actually inside a sortable header cell.
      const sorters = screen
        .getAllByText('clientColumn')
        .map(el => el.closest('.ant-table-column-sorters'))
        .filter((el): el is HTMLElement => el !== null);
      fireEvent.click(sorters[0]);

      const dispatched = mocks.dispatch.mock.calls.map(([action]) => action);
      expect(dispatched).toContainEqual(
        expect.objectContaining({ type: 'requestsReducer/setSortBy', payload: 'client_name' })
      );
      expect(dispatched).toContainEqual(
        expect.objectContaining({ type: 'requestsReducer/setSortOrder', payload: 'asc' })
      );
    });
  });

  describe('pagination', () => {
    it('renders the shared TablePagination summary and responds to page changes', () => {
      setRequests(
        Array.from({ length: 10 }, (_, i) => buildRequest({ id: `req-${i}`, req_no: `REQ-000${i}` })),
        25
      );
      renderTable();

      expect(screen.getByText('Showing 1-10 of 25 requests')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '›' }));

      expect(mocks.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'requestsReducer/setPage', payload: 2 })
      );
    });
  });
});
