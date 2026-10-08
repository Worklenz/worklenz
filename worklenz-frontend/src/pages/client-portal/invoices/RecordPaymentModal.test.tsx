import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordPayment: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  onClose: vi.fn(),
  onSaved: vi.fn(),
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

vi.mock('../../../api/client-portal/client-portal-api', () => ({
  useRecordInvoicePaymentMutation: () => [mocks.recordPayment, { isLoading: false }],
}));

import { RecordPaymentModal } from './RecordPaymentModal';

const invoice = {
  id: 'inv-047',
  invoiceNumber: 'INV-047',
  amount: 9300,
  currency: 'USD',
  paidAmount: 0,
  paymentStatus: 'unpaid' as const,
};

const renderModal = (initialStatus?: 'paid' | 'partially_paid') =>
  render(
    <RecordPaymentModal
      open
      invoice={invoice}
      initialStatus={initialStatus}
      onClose={mocks.onClose}
      onSaved={mocks.onSaved}
    />
  );

describe('RecordPaymentModal', () => {
  beforeEach(() => {
    mocks.recordPayment.mockClear();
    mocks.onClose.mockClear();
    mocks.onSaved.mockClear();
  });

  it('defaults to Paid and locks Paid Amount to the full invoice amount', async () => {
    renderModal();

    const amount = screen.getByLabelText('Paid Amount') as HTMLInputElement;
    expect(amount).toBeDisabled();
    expect(amount.value).toBe('9300.00');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocks.recordPayment).toHaveBeenCalledWith({
        id: 'inv-047',
        paymentStatus: 'paid',
        paidAmount: 9300,
        proof: null,
      })
    );
    expect(mocks.onSaved).toHaveBeenCalled();
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it('opens on Partially Paid with an editable amount when asked to', () => {
    renderModal('partially_paid');

    expect(screen.getByLabelText('Paid Amount')).not.toBeDisabled();
  });

  it('saves a partial payment, clamping an over-large amount to the invoice total', async () => {
    renderModal('partially_paid');

    const amount = screen.getByLabelText('Paid Amount');
    fireEvent.change(amount, { target: { value: '20000' } });
    fireEvent.blur(amount);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.recordPayment).toHaveBeenCalled());
    expect(mocks.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'partially_paid', paidAmount: 9300 })
    );
  });

  it('snaps back to the full amount when switching from Partially Paid to Paid', () => {
    renderModal('partially_paid');

    fireEvent.click(screen.getByText('Paid'));

    const amount = screen.getByLabelText('Paid Amount') as HTMLInputElement;
    expect(amount).toBeDisabled();
    expect(amount.value).toBe('9300.00');
  });
});
