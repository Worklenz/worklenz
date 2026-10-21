import config from '../../../config/env';
import { API_BASE_URL } from '../../../shared/constants';
import { getCurrencySymbol } from '../../../shared/currencies';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const getInvoiceDownloadUrl = (invoiceId: string) =>
  `${config.apiUrl.replace(/\/$/, '')}${API_BASE_URL}/clients/portal/invoices/${invoiceId}/download`;

/** Document status: where the invoice is in its lifecycle. Independent of payment. */
export type InvoiceStatus = 'draft' | 'sent' | 'pending' | 'overdue' | 'cancelled';

/** How much of the invoice has been paid. Independent of the document status. */
export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export type InvoiceDiscountType = 'percentage' | 'fixed';

export const INVOICE_STATUS_VALUES: InvoiceStatus[] = ['draft', 'sent', 'pending', 'overdue'];

export const INVOICE_PAYMENT_STATUS_VALUES: InvoicePaymentStatus[] = [
  'unpaid',
  'partially_paid',
  'paid',
];

/**
 * A request can be billed once staff have started acting on it. Team-defined (custom) statuses
 * count too, so this is a deny-list — the same rule as the Requests table's "Create Invoice" item
 * and the API.
 */
export const isInvoiceableRequestStatus = (status: string | null | undefined) =>
  !['pending', 'rejected'].includes(String(status ?? '').toLowerCase());

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  rate: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const getLineAmount = (item: Pick<InvoiceLineItemInput, 'quantity' | 'rate'>) =>
  roundMoney((Number(item.quantity) || 0) * (Number(item.rate) || 0));

/**
 * Subtotal, discount, tax and total for a set of line items. The discount can never exceed the
 * subtotal, and tax applies to what is left after the discount.
 */
export const computeInvoiceTotals = (
  lineItems: InvoiceLineItemInput[],
  discountType: InvoiceDiscountType,
  discountValue: number,
  taxRate: number
): InvoiceTotals => {
  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + getLineAmount(item), 0));
  const rawDiscount =
    discountType === 'percentage'
      ? (subtotal * (Number(discountValue) || 0)) / 100
      : Number(discountValue) || 0;
  const discountAmount = roundMoney(Math.min(Math.max(rawDiscount, 0), subtotal));
  const taxable = subtotal - discountAmount;
  const taxAmount = roundMoney((taxable * (Number(taxRate) || 0)) / 100);

  return { subtotal, discountAmount, taxAmount, total: roundMoney(taxable + taxAmount) };
};

/** Paid Amount is always within [0, invoice amount]. */
export const clampPaidAmount = (value: number | null | undefined, invoiceAmount: number) =>
  roundMoney(Math.min(Math.max(Number(value) || 0, 0), Math.max(invoiceAmount, 0)));

/**
 * What a payment-status change means for Paid Amount: Paid locks it to the full amount, Unpaid
 * clears it, Partially Paid keeps whatever was entered (clamped).
 */
export const resolvePaidAmount = (
  paymentStatus: InvoicePaymentStatus,
  invoiceAmount: number,
  enteredAmount?: number | null
) => {
  if (paymentStatus === 'paid') return roundMoney(invoiceAmount);
  if (paymentStatus === 'unpaid') return 0;
  return clampPaidAmount(enteredAmount, invoiceAmount);
};

export const isInvoiceOverdue = (invoice: {
  dueDate?: string | null;
  paymentStatus?: string;
  status?: string;
  isOverdue?: boolean;
}) => {
  if (invoice.isOverdue !== undefined) return Boolean(invoice.isOverdue);
  if (!invoice.dueDate || invoice.paymentStatus === 'paid') return false;
  return new Date(invoice.dueDate) < new Date(new Date().toDateString());
};

export const formatMoney = (amount: number, currency = 'USD') =>
  `${getCurrencySymbol(currency)}${(Number(amount) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const normalizePaymentStatus = (value: string | undefined): InvoicePaymentStatus =>
  value === 'paid' || value === 'partially_paid' ? value : 'unpaid';
