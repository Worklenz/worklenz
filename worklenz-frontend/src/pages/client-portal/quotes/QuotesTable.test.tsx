import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryArgs: [] as Array<Record<string, unknown>>,
  refetch: vi.fn(),
  updateQuoteStatus: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  deleteQuote: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  duplicateQuote: vi.fn(() => ({
    unwrap: () => Promise.resolve({ body: { id: 'quo-2', quoteNumber: 'QUO-002' } }),
  })),
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

vi.mock('../../../utils/dateUtils', () => ({ formatDate: () => 'Sep 20, 2026' }));

vi.mock('../../../api/client-portal/client-portal-quotes-api', () => ({
  useGetQuotesQuery: (args: Record<string, unknown>) => {
    mocks.queryArgs.push(args);
    return { ...mocks.query, refetch: mocks.refetch };
  },
  useUpdateQuoteStatusMutation: () => [mocks.updateQuoteStatus],
  useDuplicateQuoteMutation: () => [mocks.duplicateQuote],
  useDeleteQuoteMutation: () => [mocks.deleteQuote],
}));

import { QuotesTable } from './QuotesTable';

const quote = (overrides: Record<string, unknown> = {}) => ({
  id: 'quo-1',
  quoteNumber: 'QUO-001',
  amount: 7200,
  currency: 'USD',
  status: 'sent',
  validUntil: '2099-05-18',
  createdAt: '2026-05-04',
  projectName: 'Content refresh',
  clientId: 'client-1',
  clientName: 'Brandbase',
  ...overrides,
});

const setQuotes = (quotes: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => {
  mocks.query.data = {
    done: true,
    body: { quotes, total: quotes.length, page: 1, limit: 10, ...extra },
  };
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderTable = () =>
  render(
    <MemoryRouter initialEntries={['/worklenz/client-portal/quotes']}>
      <QuotesTable />
      <LocationProbe />
    </MemoryRouter>
  );

const lastQueryArgs = () => mocks.queryArgs[mocks.queryArgs.length - 1];

describe('QuotesTable', () => {
  beforeEach(() => {
    mocks.queryArgs.length = 0;
    mocks.refetch.mockReset();
    mocks.updateQuoteStatus.mockClear();
    mocks.duplicateQuote.mockClear();
    mocks.deleteQuote.mockClear();
    mocks.query.data = undefined;
    mocks.query.isFetching = false;
    mocks.query.error = undefined;
  });

  it('renders the spec columns for each quote', () => {
    setQuotes([quote()]);
    renderTable();

    ['Quote', 'Client', 'Project', 'Amount', 'Status', 'Issued', 'Valid Until'].forEach(title => {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    });
    expect(screen.getByText('QUO-001')).toBeInTheDocument();
    expect(screen.getByText('Brandbase')).toBeInTheDocument();
    expect(screen.getByText('Content refresh')).toBeInTheDocument();
    expect(screen.getAllByText('$7,200.00').length).toBeGreaterThan(0);
  });

  it('shows Total quoted, Accepted and Pending from the organization totals', () => {
    setQuotes([quote()], {
      totals: { totalQuoted: 20000, totalAccepted: 600, totalPending: 12600 },
    });
    renderTable();

    expect(screen.getByText('Total quoted').nextSibling).toHaveTextContent('$20,000.00');
    expect(screen.getAllByText('Accepted')[0].nextSibling).toHaveTextContent('$600.00');
    expect(screen.getByText('Pending').nextSibling).toHaveTextContent('$12,600.00');
  });

  it('falls back to the visible rows when the API sends no totals', () => {
    setQuotes([
      quote({ id: 'a', amount: 100, status: 'accepted' }),
      quote({ id: 'b', amount: 50, status: 'draft' }),
      quote({ id: 'c', amount: 25, status: 'sent' }),
      quote({ id: 'd', amount: 10, status: 'declined' }),
    ]);
    renderTable();

    // Pending is Draft + Sent only; Declined counts toward the total but not Pending.
    expect(screen.getByText('Total quoted').nextSibling).toHaveTextContent('$185.00');
    expect(screen.getAllByText('Accepted')[0].nextSibling).toHaveTextContent('$100.00');
    expect(screen.getByText('Pending').nextSibling).toHaveTextContent('$75.00');
  });

  it('changes a quote status inline from the row', async () => {
    setQuotes([quote()]);
    renderTable();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status for QUO-001' }));
    fireEvent.click(await screen.findByTitle('Accepted'));

    await waitFor(() =>
      expect(mocks.updateQuoteStatus).toHaveBeenCalledWith({ id: 'quo-1', status: 'accepted' })
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/worklenz/client-portal/quotes');
  });

  it('opens a quote when its row is clicked', () => {
    setQuotes([quote()]);
    renderTable();

    fireEvent.click(screen.getByText('QUO-001'));

    expect(screen.getByTestId('location')).toHaveTextContent('/worklenz/client-portal/quotes/quo-1');
  });

  it('deletes a quote of any status after confirming', async () => {
    setQuotes([quote({ status: 'accepted' })]);
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for QUO-001' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));

    // Nothing is deleted until the confirmation is accepted.
    expect(mocks.deleteQuote).not.toHaveBeenCalled();
    expect(await screen.findByText('Are you sure you want to delete QUO-001? This cannot be undone.')).toBeInTheDocument();

    const dialog = Array.from(document.querySelectorAll('.ant-modal-confirm')).pop() as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mocks.deleteQuote).toHaveBeenCalledWith('quo-1'));
  });

  it('does not delete when the confirmation is cancelled', async () => {
    setQuotes([quote()]);
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for QUO-001' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    await screen.findAllByText('Delete Quote');
    const dialog = Array.from(document.querySelectorAll('.ant-modal-confirm')).pop() as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(mocks.deleteQuote).not.toHaveBeenCalled();
  });

  it('offers View, Download and Duplicate in the row menu', async () => {
    setQuotes([quote()]);
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for QUO-001' }));

    expect(await screen.findByRole('menuitem', { name: /View/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Download Quote/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Duplicate Quote/ })).toBeInTheDocument();
  });

  it('duplicates a quote from the row menu', async () => {
    setQuotes([quote()]);
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for QUO-001' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Duplicate Quote/ }));

    await waitFor(() => expect(mocks.duplicateQuote).toHaveBeenCalledWith('quo-1'));
  });

  it('sends the status filter to the API and resets to the first page', async () => {
    setQuotes([quote()]);
    renderTable();

    const toolbarSelect = screen.getByRole('combobox', { name: 'Filter by status' });
    fireEvent.mouseDown(toolbarSelect);
    fireEvent.click(await screen.findByTitle('Declined'));

    await waitFor(() => expect(lastQueryArgs()).toMatchObject({ status: 'declined', page: 1 }));
  });

  it('shows the empty state with a create action when there are no quotes', () => {
    setQuotes([]);
    renderTable();

    expect(screen.getByText('No Quotes Found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Quote' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/worklenz/client-portal/quotes/create');
  });

  it('shows an error state with a retry', () => {
    mocks.query.error = { status: 500 };
    renderTable();

    expect(screen.getByText('Error Loading Quotes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('uses the shared pagination bar with a quotes summary', () => {
    setQuotes([quote()], { total: 42 });
    renderTable();

    const summary = screen.getByText('Showing 1-10 of 42 quotes');
    expect(within(summary.parentElement as HTMLElement).getByLabelText('Rows per page:')).toBeInTheDocument();
  });
});
