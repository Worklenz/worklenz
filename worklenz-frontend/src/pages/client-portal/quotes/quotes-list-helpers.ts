import config from '../../../config/env';
import { API_BASE_URL } from '../../../shared/constants';
import type { ClientPortalQuoteStatus } from '../../../api/client-portal/client-portal-quotes-api';

// Totals, line-amount maths and money formatting are the same as invoices; one implementation
// keeps a quote's total identical to the invoice it may later become.
export {
  PAGE_SIZE_OPTIONS,
  computeInvoiceTotals,
  formatMoney,
  getLineAmount,
  isInvoiceableRequestStatus,
} from '../invoices/invoices-list-helpers';
export type {
  InvoiceDiscountType,
  InvoiceLineItemInput,
  InvoiceTotals,
} from '../invoices/invoices-list-helpers';

export const getQuoteDownloadUrl = (quoteId: string) =>
  `${config.apiUrl.replace(/\/$/, '')}${API_BASE_URL}/clients/portal/quotes/${quoteId}/download`;

export const QUOTE_STATUS_VALUES: ClientPortalQuoteStatus[] = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
];

/** Statuses counted as Pending in the stat row: the quote is waiting on the client. */
export const PENDING_QUOTE_STATUSES: ClientPortalQuoteStatus[] = ['draft', 'sent'];

/** Valid Until is shown in red once staff have marked the quote Expired. */
export const isQuoteExpired = (quote: { status?: string }) => quote.status === 'expired';

export const normalizeQuoteStatus = (value: string | undefined): ClientPortalQuoteStatus =>
  QUOTE_STATUS_VALUES.includes(value as ClientPortalQuoteStatus)
    ? (value as ClientPortalQuoteStatus)
    : 'draft';

/** Tag colour per status (antd preset colours, so both themes are handled by antd). */
export const QUOTE_STATUS_TAG_COLOR: Record<ClientPortalQuoteStatus, string> = {
  draft: 'default',
  sent: 'processing',
  accepted: 'success',
  declined: 'error',
  expired: 'warning',
};
