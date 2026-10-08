import { describe, expect, it } from 'vitest';
import {
  PENDING_QUOTE_STATUSES,
  QUOTE_STATUS_VALUES,
  computeInvoiceTotals,
  getQuoteDownloadUrl,
  isInvoiceableRequestStatus,
  isQuoteExpired,
  normalizeQuoteStatus,
} from './quotes-list-helpers';

describe('quote statuses', () => {
  it('has the five staff-managed statuses, in lifecycle order', () => {
    expect(QUOTE_STATUS_VALUES).toEqual(['draft', 'sent', 'accepted', 'declined', 'expired']);
  });

  it('counts only draft and sent as pending', () => {
    expect(PENDING_QUOTE_STATUSES).toEqual(['draft', 'sent']);
  });

  it('marks Valid Until red only for an expired quote', () => {
    expect(isQuoteExpired({ status: 'expired' })).toBe(true);
    // A lapsed date alone does not expire a quote: that is always a manual staff action.
    expect(isQuoteExpired({ status: 'sent' })).toBe(false);
  });

  it('falls back to draft for an unknown status', () => {
    expect(normalizeQuoteStatus('accepted')).toBe('accepted');
    expect(normalizeQuoteStatus('paid')).toBe('draft');
    expect(normalizeQuoteStatus(undefined)).toBe('draft');
  });
});

describe('quote totals', () => {
  it('uses the invoice maths: discount first, then tax', () => {
    const totals = computeInvoiceTotals(
      [{ description: 'Design', quantity: 2, rate: 1000 }],
      'percentage',
      10,
      10
    );
    expect(totals).toEqual({ subtotal: 2000, discountAmount: 200, taxAmount: 180, total: 1980 });
  });
});

describe('quotable requests', () => {
  it('allows the same requests as invoicing: everything but pending and rejected', () => {
    expect(isInvoiceableRequestStatus('accepted')).toBe(true);
    expect(isInvoiceableRequestStatus('in_progress')).toBe(true);
    expect(isInvoiceableRequestStatus('Awaiting deposit')).toBe(true);
    expect(isInvoiceableRequestStatus('pending')).toBe(false);
    expect(isInvoiceableRequestStatus('rejected')).toBe(false);
  });
});

describe('getQuoteDownloadUrl', () => {
  it('points at the quote download endpoint', () => {
    expect(getQuoteDownloadUrl('q-1')).toMatch(/\/api\/v1\/clients\/portal\/quotes\/q-1\/download$/);
  });
});
