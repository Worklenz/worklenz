import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createInvoice: vi.fn(() => ({ unwrap: () => Promise.resolve({ body: { id: 'new-1' } }) })),
  updateInvoice: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  requests: [] as Array<Record<string, unknown>>,
  clients: [] as Array<Record<string, unknown>>,
  requestInvoices: [] as Array<Record<string, unknown>>,
  services: [] as Array<Record<string, unknown>>,
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

vi.mock('./invoice-details/invoice-preview-modal', () => ({
  default: ({ open, invoice }: { open: boolean; invoice: { amount: number } }) =>
    open ? <div data-testid="preview">{`preview total ${invoice.amount}`}</div> : null,
}));

vi.mock('../../../api/client-portal/client-portal-api', () => ({
  useCreateInvoiceMutation: () => [mocks.createInvoice],
  useUpdateInvoiceMutation: () => [mocks.updateInvoice],
  useGetInvoiceDetailsQuery: () => ({ data: undefined, isLoading: false }),
  useGetOrganizationRequestsQuery: () => ({
    data: { body: { data: mocks.requests, total: mocks.requests.length } },
    isLoading: false,
  }),
  useGetClientsQuery: () => ({
    data: { body: { clients: mocks.clients, total: mocks.clients.length } },
    isLoading: false,
  }),
  useGetInvoicesByRequestQuery: () => ({
    data: { body: { invoices: mocks.requestInvoices, count: mocks.requestInvoices.length } },
  }),
  useGetOrganizationServicesQuery: () => ({
    data: { body: { data: mocks.services, total: mocks.services.length } },
    isLoading: false,
  }),
}));

import CreateInvoiceModal from './CreateInvoiceModal';

const request = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  req_no: 'REQ-0001',
  status: 'accepted',
  service_name: 'Landing Page Design',
  client_id: 'client-1',
  client_name: 'TechFlow Inc',
  request_data: { title: 'Need to design website' },
  ...overrides,
});

const renderModal = (url = '/worklenz/client-portal/invoices/create') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <CreateInvoiceModal />
    </MemoryRouter>
  );

const descriptionInputs = () => screen.getAllByLabelText('Description') as HTMLInputElement[];

describe('CreateInvoiceModal', () => {
  beforeEach(() => {
    mocks.createInvoice.mockClear();
    mocks.updateInvoice.mockClear();
    mocks.requests = [request()];
    mocks.clients = [{ id: 'client-1', name: 'TechFlow Inc', email: 'pm@techflow.com' }];
    mocks.requestInvoices = [];
    mocks.services = [];
  });

  it('starts with one empty line item that cannot be removed', () => {
    renderModal();

    expect(descriptionInputs()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeDisabled();
  });

  it('adds and removes line items but always keeps at least one', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Add Service/ }));
    expect(descriptionInputs()).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[0]);
    expect(descriptionInputs()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeDisabled();
  });

  it('prefills the project and first line from a linked request in the URL', async () => {
    renderModal('/worklenz/client-portal/invoices/create?requestId=req-1');

    await waitFor(() => expect(descriptionInputs()[0].value).toBe('Landing Page Design'));
    expect(screen.getByDisplayValue('Need to design website')).toBeInTheDocument();
    // The client comes from the request, so there is no manual client picker.
    expect(screen.getByText('TechFlow Inc')).toBeInTheDocument();
  });

  it('does not offer requests that are not billable yet', () => {
    mocks.requests = [request({ id: 'req-2', req_no: 'REQ-0002', status: 'pending' })];
    renderModal();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Select Request' }));

    expect(screen.queryByText(/REQ-0002/)).not.toBeInTheDocument();
  });

  it('warns when the linked request already has invoices', () => {
    mocks.requestInvoices = [{ id: 'inv-1' }, { id: 'inv-2' }];
    renderModal('/worklenz/client-portal/invoices/create?requestId=req-1');

    expect(screen.getByText(/already has 2 invoice\(s\)/)).toBeInTheDocument();
  });

  it('blocks saving with no client and no linked request', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(await screen.findByText('Please select a client')).toBeInTheDocument();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it('blocks saving when no line item has a description and an amount', async () => {
    renderModal('/worklenz/client-portal/invoices/create?clientId=client-1');

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(
      await screen.findByText('Please add at least one item with description and amount')
    ).toBeInTheDocument();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it('creates a standalone draft for the URL client with server-bound totals', async () => {
    renderModal('/worklenz/client-portal/invoices/create?clientId=client-1');

    fireEvent.change(descriptionInputs()[0], { target: { value: 'Retainer' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Tax'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.createInvoice).toHaveBeenCalled());
    expect(mocks.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        requestId: undefined,
        status: 'draft',
        subtotal: 2000,
        taxAmount: 200,
        amount: 2200,
        lineItems: [{ description: 'Retainer', quantity: 2, rate: 1000, amount: 2000 }],
      })
    );
  });

  it('updates the live summary as line items and discount change', () => {
    renderModal('/worklenz/client-portal/invoices/create?clientId=client-1');

    fireEvent.change(descriptionInputs()[0], { target: { value: 'Retainer' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Discount'), { target: { value: '10' } });

    const summary = screen.getByText('Subtotal').closest('.ant-card') as HTMLElement;
    expect(within(summary).getAllByText('$1,000.00').length).toBeGreaterThan(0);
    expect(within(summary).getByText('-$100.00')).toBeInTheDocument();
    expect(within(summary).getByText('$900.00')).toBeInTheDocument();
  });

  it('previews the unsaved form', async () => {
    renderModal('/worklenz/client-portal/invoices/create?clientId=client-1');

    fireEvent.change(descriptionInputs()[0], { target: { value: 'Retainer' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByTestId('preview')).toHaveTextContent('preview total 500');
  });
});
