import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  resend: vi.fn(),
  onInvited: vi.fn(),
  invoicesTableProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      let value = String(options.defaultValue ?? key);
      Object.entries(options).forEach(([param, paramValue]) => {
        value = value.split(`{{${param}}}`).join(String(paramValue));
      });
      return value;
    },
  }),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));

vi.mock('@/api/client-portal/client-portal-api', () => ({
  useResendClientInvitationMutation: () => [mocks.resend, { isLoading: false }],
}));

vi.mock('../../invoices/Invoices-table/invoices-table', () => ({
  InvoicesTable: (props: Record<string, unknown>) => {
    mocks.invoicesTableProps.push(props);
    return <div>invoices table</div>;
  },
}));

import { BillingTab } from './BillingTab';

const renderTab = (portalStatus: Parameters<typeof BillingTab>[0]['portalStatus']) =>
  render(
    <BillingTab
      clientId="client-1"
      clientName="Beacon Logistics"
      portalStatus={portalStatus}
      onInvited={mocks.onInvited}
    />
  );

describe('BillingTab', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.onInvited.mockReset();
    mocks.invoicesTableProps.length = 0;
    mocks.resend.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  describe('portal access warning', () => {
    it.each(['not_invited', 'invited', 'expired'] as const)(
      'warns up front when the client is %s, before any billing action',
      status => {
        renderTab(status);

        expect(screen.getByText('Beacon Logistics can’t use their portal yet')).toBeInTheDocument();
        expect(screen.getByText(/They haven’t accepted an invitation/)).toBeInTheDocument();
      }
    );

    it('does not warn for a client who can use the portal', () => {
      renderTab('active');

      expect(screen.queryByText(/can’t use their portal yet/)).not.toBeInTheDocument();
    });

    it('does not warn while the status is still loading', () => {
      renderTab(undefined);

      expect(screen.queryByText(/can’t use their portal yet/)).not.toBeInTheDocument();
    });

    it('does not talk about a bank account, which nothing here connects', () => {
      renderTab('not_invited');

      expect(screen.queryByText(/bank/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/subscription/i)).not.toBeInTheDocument();
    });

    it('offers Send invite to a client who was never invited, and Resend to one who was', () => {
      const { unmount } = renderTab('not_invited');
      expect(screen.getByRole('button', { name: 'Send invite' })).toBeInTheDocument();
      unmount();

      renderTab('expired');
      expect(screen.getByRole('button', { name: 'Resend invite' })).toBeInTheDocument();
    });

    it('sends the invitation and refreshes the client’s status', async () => {
      renderTab('not_invited');

      fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

      await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith({ clientId: 'client-1' }));
      await waitFor(() => expect(mocks.onInvited).toHaveBeenCalledTimes(1));
    });

    it('shows the server’s reason when the invitation fails, and does not refresh', async () => {
      mocks.resend.mockReturnValue({
        unwrap: () => Promise.reject({ data: { message: 'Client has already joined the portal' } }),
      });
      renderTab('invited');

      fireEvent.click(screen.getByRole('button', { name: 'Resend invite' }));

      expect(await screen.findByText('Client has already joined the portal')).toBeInTheDocument();
      expect(mocks.onInvited).not.toHaveBeenCalled();
    });
  });

  it('starts an invoice for this client', () => {
    renderTab('active');

    fireEvent.click(screen.getByRole('button', { name: /Create invoice/ }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/worklenz/client-portal/invoices/create?clientId=client-1'
    );
  });

  it('does not offer a subscription, which does not exist', () => {
    renderTab('active');

    expect(screen.queryByRole('button', { name: /subscription/i })).not.toBeInTheDocument();
  });

  it('lists only this client’s invoices, inside the tab', () => {
    renderTab('active');

    expect(screen.getByText('invoices table')).toBeInTheDocument();
    expect(mocks.invoicesTableProps[0]).toMatchObject({ clientId: 'client-1', embedded: true });
  });
});
