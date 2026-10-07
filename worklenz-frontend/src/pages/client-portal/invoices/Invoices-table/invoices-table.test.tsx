import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryArgs: [] as Array<Record<string, unknown>>,
  refetch: vi.fn(),
  updateInvoice: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  recordPayment: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  duplicateInvoice: vi.fn(() => ({
    unwrap: () => Promise.resolve({ body: { id: 'inv-2', invoiceNumber: 'INV-002' } }),
  })),
  deleteInvoice: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
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

vi.mock('../../../../utils/dateUtils', () => ({ formatDate: () => 'Sep 20, 2026' }));

vi.mock('../../../../api/client-portal/client-portal-api', () => ({
  useGetInvoicesQuery: (args: Record<string, unknown>) => {
    mocks.queryArgs.push(args);
    return { ...mocks.query, refetch: mocks.refetch };
  },
  useUpdateInvoiceMutation: () => [mocks.updateInvoice],
  useRecordInvoicePaymentMutation: () => [mocks.recordPayment, { isLoading: false }],
  useDuplicateInvoiceMutation: () => [mocks.duplicateInvoice],
  useDeleteInvoiceMutation: () => [mocks.deleteInvoice],
}));

import { InvoicesTable } from './invoices-table';

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  invoiceNumber: 'INV-001',
  amount: 250,
  currency: 'USD',
  status: 'sent',
  paymentStatus: 'unpaid',
  paidAmount: 0,
  dueDate: '2099-09-30',
  createdAt: '2026-09-01',
  projectName: 'Brand refresh',
  serviceName: 'Branding',
  clientId: 'client-1',
  clientName: 'Beacon Logistics',
  ...overrides,
});

const setInvoices = (
  invoices: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {}
) => {
  mocks.query.data = {
    done: true,
    body: { invoices, total: invoices.length, page: 1, limit: 10, ...extra },
  };
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderTable = (props: Parameters<typeof InvoicesTable>[0] = {}) =>
  render(
    <MemoryRouter initialEntries={['/worklenz/client-portal/invoices']}>
      <InvoicesTable {...props} />
      <LocationProbe />
    </MemoryRouter>
  );

const lastQueryArgs = () => mocks.queryArgs[mocks.queryArgs.length - 1];

describe('InvoicesTable', () => {
  beforeEach(() => {
    mocks.queryArgs.length = 0;
    mocks.refetch.mockReset();
    mocks.updateInvoice.mockClear();
    mocks.recordPayment.mockClear();
    mocks.duplicateInvoice.mockClear();
    mocks.deleteInvoice.mockClear();
    mocks.query.data = undefined;
    mocks.query.isFetching = false;
    mocks.query.error = undefined;
  });

  it('renders the Requests-style columns for each invoice', () => {
    setInvoices([invoice()]);
    renderTable();

    ['Invoice', 'Client', 'Service', 'Amount', 'Payment Status', 'Paid Amount', 'Status', 'Issued', 'Due'].forEach(
      title => {
        expect(screen.getAllByText(title).length).toBeGreaterThan(0);
      }
    );
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('Beacon Logistics')).toBeInTheDocument();
    expect(screen.getByText('Brand refresh')).toBeInTheDocument();
    expect(screen.getAllByText('$250.00').length).toBeGreaterThan(0);
  });

  it('uses the shared pagination bar with a "Showing x-y of z invoices" summary', () => {
    setInvoices([invoice()], { total: 42 });
    renderTable();

    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-10 of 42 invoices')).toBeInTheDocument();
  });

  it('changes page size through the pagination bar and resets to the first page', () => {
    setInvoices([invoice()], { total: 42 });
    renderTable();

    fireEvent.change(screen.getByLabelText('Rows per page:'), { target: { value: '25' } });

    expect(lastQueryArgs()).toMatchObject({ page: 1, limit: 25 });
  });

  it('shows stat cards from the organization totals, not just the visible rows', () => {
    setInvoices([invoice()], {
      totals: { totalInvoiced: 9300, totalPaid: 4000, totalOutstanding: 5300 },
    });
    renderTable();

    expect(screen.getByText('Total invoiced')).toBeInTheDocument();
    expect(screen.getByText('$9,300.00')).toBeInTheDocument();
    expect(screen.getByText('$4,000.00')).toBeInTheDocument();
    expect(screen.getByText('$5,300.00')).toBeInTheDocument();
  });

  it('falls back to summing the visible rows when the API sends no totals', () => {
    setInvoices([
      invoice({ id: 'a', amount: 100, paidAmount: 40 }),
      invoice({ id: 'b', invoiceNumber: 'INV-002', amount: 200, paidAmount: 0 }),
    ]);
    renderTable();

    expect(screen.getAllByText('$300.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$40.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$260.00').length).toBeGreaterThan(0);
  });

  it('only lets Paid Amount be edited while Payment Status is Partially Paid', () => {
    setInvoices([
      invoice({ id: 'a', invoiceNumber: 'INV-A', paymentStatus: 'unpaid' }),
      invoice({ id: 'b', invoiceNumber: 'INV-B', paymentStatus: 'paid', paidAmount: 250 }),
      invoice({ id: 'c', invoiceNumber: 'INV-C', paymentStatus: 'partially_paid', paidAmount: 100 }),
    ]);
    renderTable();

    expect(screen.queryByLabelText('Paid amount for INV-A')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Paid amount for INV-B')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Paid amount for INV-C')).toBeInTheDocument();
  });

  it('clamps an edited Paid Amount to the invoice amount before saving it', async () => {
    setInvoices([invoice({ paymentStatus: 'partially_paid', paidAmount: 100 })]);
    renderTable();

    const input = screen.getByLabelText('Paid amount for INV-001');
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(mocks.recordPayment).toHaveBeenCalledWith({
        id: 'inv-1',
        paymentStatus: 'partially_paid',
        paidAmount: 250,
      })
    );
  });

  it('clears the payment straight away when Payment Status is set back to Unpaid', () => {
    setInvoices([invoice({ paymentStatus: 'partially_paid', paidAmount: 100 })]);
    renderTable();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Payment status for INV-001' }));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="Unpaid"]')!);

    expect(mocks.recordPayment).toHaveBeenCalledWith({
      id: 'inv-1',
      paymentStatus: 'unpaid',
      paidAmount: 0,
    });
  });

  it('opens Record Payment instead of saving when Payment Status is set to Paid', async () => {
    setInvoices([invoice()]);
    renderTable();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Payment status for INV-001' }));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="Paid"]')!);

    expect(await screen.findByText(/Record a payment for INV-001/)).toBeInTheDocument();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it('updates the document status inline without opening the invoice', () => {
    setInvoices([invoice()]);
    renderTable();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status for INV-001' }));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="Pending"]')!);

    expect(mocks.updateInvoice).toHaveBeenCalledWith({ id: 'inv-1', data: { status: 'pending' } });
    expect(screen.getByTestId('location')).toHaveTextContent('/worklenz/client-portal/invoices');
    expect(screen.getByTestId('location').textContent).not.toContain('inv-1');
  });

  it('marks an overdue due date as danger and leaves on-time dates plain', () => {
    setInvoices([
      invoice({ id: 'a', invoiceNumber: 'INV-LATE', dueDate: '2020-01-01' }),
      invoice({ id: 'b', invoiceNumber: 'INV-OK', dueDate: '2099-01-01' }),
    ]);
    renderTable();

    const rows = screen.getAllByRole('row');
    const lateRow = rows.find(row => within(row).queryByText('INV-LATE'))!;
    const okRow = rows.find(row => within(row).queryByText('INV-OK'))!;

    expect(lateRow.querySelector('.ant-typography-danger')).not.toBeNull();
    expect(okRow.querySelector('.ant-typography-danger')).toBeNull();
  });

  it('does not treat a paid invoice as overdue even past its due date', () => {
    setInvoices([invoice({ paymentStatus: 'paid', paidAmount: 250, dueDate: '2020-01-01' })]);
    renderTable();

    const row = screen.getAllByRole('row').find(r => within(r).queryByText('INV-001'))!;
    expect(row.querySelector('.ant-typography-danger')).toBeNull();
  });

  it('opens the invoice when a row is clicked', () => {
    setInvoices([invoice()]);
    renderTable();

    fireEvent.click(screen.getByText('INV-001'));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/worklenz/client-portal/invoices/inv-1'
    );
  });

  it('duplicates an invoice from the row menu', async () => {
    setInvoices([invoice()]);
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for INV-001' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Duplicate Invoice/ }));

    expect(mocks.duplicateInvoice).toHaveBeenCalledWith('inv-1');
  });

  it.each(['paid', 'partially_paid'])('disables Delete for a %s invoice', async paymentStatus => {
    setInvoices([invoice({ paymentStatus, paidAmount: 100 })]);
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for INV-001' }));

    expect(await screen.findByRole('menuitem', { name: /Delete/ })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('sends the payment-status filter to the API and offers Clear Filters', () => {
    setInvoices([invoice()]);
    renderTable();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by payment status' }));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="Partially Paid"]')!);

    expect(lastQueryArgs()).toMatchObject({ paymentStatus: 'partially_paid', page: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(lastQueryArgs().paymentStatus).toBeUndefined();
  });

  it('shows the empty state with the create prompt when there are no invoices', () => {
    setInvoices([]);
    renderTable();

    expect(screen.getByText('No Invoices Found')).toBeInTheDocument();
  });

  it('shows a filtered empty state with Clear Filters when a filter hides everything', () => {
    setInvoices([]);
    renderTable();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by status' }));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="Draft"]')!);

    expect(screen.getByText('No invoices match the current filters.')).toBeInTheDocument();
  });

  it('shows an error alert with Retry when loading fails', () => {
    mocks.query.error = { status: 500 };
    renderTable();

    expect(screen.getByText('Error Loading Invoices')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  describe('embedded (client workspace Billing tab)', () => {
    it('scopes the query to the client and drops the Client column and stat cards', () => {
      setInvoices([invoice()]);
      renderTable({ clientId: 'client-1', embedded: true });

      expect(lastQueryArgs()).toMatchObject({ clientId: 'client-1' });
      expect(screen.queryByText('Client')).not.toBeInTheDocument();
      expect(screen.queryByText('Total invoiced')).not.toBeInTheDocument();
      expect(screen.getByText('INV-001')).toBeInTheDocument();
    });
  });
});
