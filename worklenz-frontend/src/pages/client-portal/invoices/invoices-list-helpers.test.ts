import { describe, expect, it } from 'vitest';
import {
  clampPaidAmount,
  computeInvoiceTotals,
  isInvoiceOverdue,
  isInvoiceableRequestStatus,
  resolvePaidAmount,
} from './invoices-list-helpers';

describe('computeInvoiceTotals', () => {
  const lines = [
    { description: 'Design', quantity: 2, rate: 1000 },
    { description: 'Build', quantity: 1, rate: 500.5 },
  ];

  it('sums line amounts into the subtotal', () => {
    expect(computeInvoiceTotals(lines, 'percentage', 0, 0)).toEqual({
      subtotal: 2500.5,
      discountAmount: 0,
      taxAmount: 0,
      total: 2500.5,
    });
  });

  it('applies a percentage discount before tax', () => {
    const totals = computeInvoiceTotals(lines, 'percentage', 10, 10);
    expect(totals.discountAmount).toBe(250.05);
    // (2500.50 - 250.05) * 10% = 225.045 -> 225.05 (rounded to cents)
    expect(totals.taxAmount).toBe(225.05);
    expect(totals.total).toBe(2475.5);
  });

  it('applies a flat discount', () => {
    const totals = computeInvoiceTotals(lines, 'fixed', 500, 0);
    expect(totals.discountAmount).toBe(500);
    expect(totals.total).toBe(2000.5);
  });

  it('never lets the discount exceed the subtotal', () => {
    const totals = computeInvoiceTotals(lines, 'fixed', 99999, 20);
    expect(totals.discountAmount).toBe(2500.5);
    expect(totals.total).toBe(0);
  });

  it('treats blank or invalid numbers as zero', () => {
    const totals = computeInvoiceTotals(
      [{ description: 'x', quantity: Number.NaN, rate: 10 }],
      'percentage',
      Number.NaN,
      Number.NaN
    );
    expect(totals.total).toBe(0);
  });
});

describe('paid amount rules', () => {
  it('clamps to [0, invoice amount]', () => {
    expect(clampPaidAmount(-5, 9300)).toBe(0);
    expect(clampPaidAmount(4000, 9300)).toBe(4000);
    expect(clampPaidAmount(99999, 9300)).toBe(9300);
    expect(clampPaidAmount(undefined, 9300)).toBe(0);
  });

  it('locks Paid to the full amount', () => {
    expect(resolvePaidAmount('paid', 9300, 4000)).toBe(9300);
  });

  it('clears the amount for Unpaid so no stale partial amount survives', () => {
    expect(resolvePaidAmount('unpaid', 9300, 4000)).toBe(0);
  });

  it('keeps a clamped entered amount for Partially Paid', () => {
    expect(resolvePaidAmount('partially_paid', 9300, 4000)).toBe(4000);
    expect(resolvePaidAmount('partially_paid', 9300, 20000)).toBe(9300);
  });
});

describe('isInvoiceOverdue', () => {
  it('is overdue when past due and not fully paid', () => {
    expect(isInvoiceOverdue({ dueDate: '2020-01-01', paymentStatus: 'unpaid' })).toBe(true);
    expect(isInvoiceOverdue({ dueDate: '2020-01-01', paymentStatus: 'partially_paid' })).toBe(true);
  });

  it('is not overdue when paid, on time, or without a due date', () => {
    expect(isInvoiceOverdue({ dueDate: '2020-01-01', paymentStatus: 'paid' })).toBe(false);
    expect(isInvoiceOverdue({ dueDate: '2099-01-01', paymentStatus: 'unpaid' })).toBe(false);
    expect(isInvoiceOverdue({ dueDate: null, paymentStatus: 'unpaid' })).toBe(false);
  });

  it('trusts the server flag when it is present', () => {
    expect(isInvoiceOverdue({ dueDate: '2099-01-01', isOverdue: true })).toBe(true);
    expect(isInvoiceOverdue({ dueDate: '2020-01-01', isOverdue: false })).toBe(false);
  });
});

describe('isInvoiceableRequestStatus', () => {
  it('allows built-in and custom statuses once staff have acted on the request', () => {
    expect(isInvoiceableRequestStatus('accepted')).toBe(true);
    expect(isInvoiceableRequestStatus('in_progress')).toBe(true);
    expect(isInvoiceableRequestStatus('completed')).toBe(true);
    expect(isInvoiceableRequestStatus('Awaiting deposit')).toBe(true);
  });

  it('blocks pending and rejected requests', () => {
    expect(isInvoiceableRequestStatus('pending')).toBe(false);
    expect(isInvoiceableRequestStatus('rejected')).toBe(false);
    expect(isInvoiceableRequestStatus(undefined)).toBe(true);
  });
});
