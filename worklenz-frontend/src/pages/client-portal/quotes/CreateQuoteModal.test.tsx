import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createQuote: vi.fn(() => ({ unwrap: () => Promise.resolve({ body: { id: 'new-1' } }) })),
  changeRequests: [] as Array<Record<string, unknown>>,
  clients: [] as Array<Record<string, unknown>>,
}));

vi.mock('../discussions/RichMessageEditor', async () => {
  const { RichMessageEditorStub } = await import('../discussions/richMessageEditorStub');
  return { RichMessageEditor: RichMessageEditorStub };
});

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

vi.mock('./quote-preview-modal', () => ({
  default: ({ open, quote }: { open: boolean; quote: { amount: number; id: string } }) =>
    open ? <div data-testid="preview">{`preview total ${quote.amount} id [${quote.id}]`}</div> : null,
}));

vi.mock('../../../api/client-portal/client-portal-quotes-api', () => ({
  useCreateQuoteMutation: () => [mocks.createQuote],
}));

vi.mock('../../../api/client-portal/client-portal-api', () => ({
  useGetClientsQuery: () => ({
    data: { body: { clients: mocks.clients, total: mocks.clients.length } },
    isLoading: false,
  }),
}));

vi.mock('../../../api/client-portal/portal-workflow-api', () => ({
  useGetBillableChangeRequestsQuery: () => ({ data: { body: mocks.changeRequests }, isLoading: false }),
}));

import CreateQuoteModal from './CreateQuoteModal';

const changeRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'cr-1',
  cr_no: 'CR-0048',
  title: 'Add a live chat widget',
  organization_id: 'client-1',
  status: 'approved',
  existing_invoice_count: 0,
  ...overrides,
});

const renderModal = (url = '/worklenz/client-portal/quotes/create') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <CreateQuoteModal />
    </MemoryRouter>
  );

const descriptionInputs = () => screen.getAllByLabelText('Description') as HTMLInputElement[];

describe('CreateQuoteModal', () => {
  beforeEach(() => {
    mocks.createQuote.mockClear();
    mocks.changeRequests = [changeRequest()];
    mocks.clients = [{ id: 'client-1', name: 'TechFlow Inc', email: 'pm@techflow.com' }];
  });

  it('starts with one empty line item that cannot be removed', () => {
    renderModal();

    expect(descriptionInputs()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeDisabled();
  });

  it('adds and removes line items but always keeps at least one', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    expect(descriptionInputs()).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[0]);
    expect(descriptionInputs()).toHaveLength(1);
  });

  it('prefills the project and a quantity-1, rate-0 first line from the change request in the URL', async () => {
    renderModal('/worklenz/client-portal/quotes/create?changeRequestId=cr-1');

    await waitFor(() => expect(descriptionInputs()[0].value).toBe('Add a live chat widget'));
    // Project and first line both carry the title; the estimate is never copied into the rate.
    expect(screen.getAllByDisplayValue('Add a live chat widget')).toHaveLength(2);
    expect((screen.getByLabelText('Rate') as HTMLInputElement).value).toBe('0.00');
    expect((screen.getByLabelText('Qty') as HTMLInputElement).value).toBe('1');
    // The client comes from the change request, so there is no manual client picker.
    expect(screen.getByText('TechFlow Inc')).toBeInTheDocument();
  });

  it('offers the billable change requests the server returned', () => {
    renderModal();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Select Change Request' }));

    expect(screen.getByText('CR-0048 - Add a live chat widget')).toBeInTheDocument();
  });

  it('blocks saving with no client and no linked change request', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(await screen.findByText('Please select a client')).toBeInTheDocument();
    expect(mocks.createQuote).not.toHaveBeenCalled();
  });

  it('blocks saving when no line item has a description and an amount', async () => {
    renderModal('/worklenz/client-portal/quotes/create?clientId=client-1');

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(
      await screen.findByText('Please add at least one item with description and amount')
    ).toBeInTheDocument();
    expect(mocks.createQuote).not.toHaveBeenCalled();
  });

  it('creates a standalone draft for the URL client', async () => {
    renderModal('/worklenz/client-portal/quotes/create?clientId=client-1');

    fireEvent.change(descriptionInputs()[0], { target: { value: 'Retainer' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Tax'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.createQuote).toHaveBeenCalled());
    // Totals are computed by the server from these inputs, so no amount is sent.
    expect(mocks.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        changeRequestId: undefined,
        status: 'draft',
        taxRate: 10,
        validUntil: null,
        lineItems: [{ description: 'Retainer', quantity: 2, rate: 1000, amount: 2000 }],
      })
    );
  });

  it('creates the quote from a change request without sending a client', async () => {
    renderModal('/worklenz/client-portal/quotes/create?changeRequestId=cr-1');

    await waitFor(() => expect(descriptionInputs()[0].value).toBe('Add a live chat widget'));
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.createQuote).toHaveBeenCalled());
    expect(mocks.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: 'cr-1',
        clientId: undefined,
        lineItems: [{ description: 'Add a live chat widget', quantity: 1, rate: 800, amount: 800 }],
      })
    );
  });

  it('creates the quote as sent for Create & Download', async () => {
    renderModal('/worklenz/client-portal/quotes/create?clientId=client-1');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    fireEvent.change(descriptionInputs()[0], { target: { value: 'Retainer' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & Download' }));

    await waitFor(() =>
      expect(mocks.createQuote).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }))
    );
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining('/clients/portal/quotes/new-1/download'),
        '_blank',
        'noopener,noreferrer'
      )
    );
    open.mockRestore();
  });

  it('updates the live summary as line items and discount change', () => {
    renderModal('/worklenz/client-portal/quotes/create?clientId=client-1');

    fireEvent.change(descriptionInputs()[0], { target: { value: 'Retainer' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Discount'), { target: { value: '10' } });

    const summary = screen.getByText('Subtotal').closest('.ant-card') as HTMLElement;
    expect(within(summary).getAllByText('$1,000.00').length).toBeGreaterThan(0);
    expect(within(summary).getByText('-$100.00')).toBeInTheDocument();
    expect(within(summary).getByText('$900.00')).toBeInTheDocument();
  });

  it('previews the unsaved form without offering a saved quote', async () => {
    renderModal('/worklenz/client-portal/quotes/create?clientId=client-1');

    fireEvent.change(descriptionInputs()[0], { target: { value: 'Retainer' } });
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    // An unsaved quote has no id, so the preview offers print but not download.
    expect(await screen.findByTestId('preview')).toHaveTextContent('preview total 500 id []');
  });
});
