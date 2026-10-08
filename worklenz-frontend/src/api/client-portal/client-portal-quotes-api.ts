import { clientPortalApi } from './client-portal-api';
import type { ClientPortalInvoiceLineItem } from './client-portal-api';

/** Set by hand by staff; nothing moves a quote between these automatically. */
export type ClientPortalQuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

interface ServerEnvelope<T> {
  done: boolean;
  body: T;
  message: string;
}

export interface ClientPortalQuote {
  id: string;
  quoteNumber: string;
  amount: number;
  currency: string;
  status: ClientPortalQuoteStatus;
  projectName?: string | null;
  /** Plain `YYYY-MM-DD`, or null when the quote has no Valid Until date. */
  validUntil: string | null;
  /** Issued: when the quote was created. */
  createdAt: string;
  updatedAt: string;
  requestNumber?: string | null;
  serviceName?: string | null;
  clientId?: string;
  clientName?: string;
}

/** Organization-wide sums for the Quotes stat cards (not just the visible page). */
export interface ClientPortalQuoteTotals {
  totalQuoted: number;
  totalAccepted: number;
  /** Draft + Sent. */
  totalPending: number;
}

export interface ClientPortalQuoteDetails extends ClientPortalQuote {
  notes?: string | null;
  lineItems?: ClientPortalInvoiceLineItem[];
  taxRate?: number;
  taxAmount?: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  subtotal?: number;
  /** Null for a standalone quote. */
  request: {
    id: string;
    requestNumber: string;
    notes?: string | null;
    service?: { id?: string; name?: string; description?: string };
  } | null;
  client: {
    id?: string;
    name?: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    contactPerson?: string | null;
  };
  createdBy: { name: string } | null;
  organization?: {
    name: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
    invoiceFooterMessage: string | null;
    templateStyle: 'classic' | 'modern';
    showLogo: boolean;
  };
}

export interface GetQuotesParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  clientId?: string;
}

export interface CreateQuoteRequest {
  /** Optional: a quote without a request is a standalone quote and needs `clientId`. */
  requestId?: string;
  clientId?: string;
  projectName?: string;
  currency?: string;
  validUntil?: string | null;
  notes?: string;
  /** A new quote can only be created as draft or sent. */
  status?: 'draft' | 'sent';
  lineItems: Array<Omit<ClientPortalInvoiceLineItem, 'id'>>;
  taxRate?: number;
  discountType?: string;
  discountValue?: number;
}

export const clientPortalQuotesApi = clientPortalApi.injectEndpoints({
  endpoints: builder => ({
    getQuotes: builder.query<
      ServerEnvelope<{
        quotes: ClientPortalQuote[];
        total: number;
        page: number;
        limit: number;
        totals?: ClientPortalQuoteTotals;
      }>,
      GetQuotesParams | void
    >({
      query: params => {
        const searchParams = new URLSearchParams();
        if (params && params.page) searchParams.set('page', String(params.page));
        if (params && params.limit) searchParams.set('limit', String(params.limit));
        if (params && params.status) searchParams.set('status', params.status);
        if (params && params.search) searchParams.set('search', params.search);
        if (params && params.sortBy) searchParams.set('sortBy', params.sortBy);
        if (params && params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
        if (params && params.clientId) searchParams.set('clientId', params.clientId);

        const queryString = searchParams.toString();
        return `/clients/portal/quotes${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Quotes'],
    }),

    getQuoteDetails: builder.query<ServerEnvelope<ClientPortalQuoteDetails>, string>({
      query: id => `/clients/portal/quotes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Quotes', id }],
    }),

    createQuote: builder.mutation<
      ServerEnvelope<{
        id: string;
        quoteNumber: string;
        amount: number;
        currency: string;
        status: ClientPortalQuoteStatus;
        validUntil: string | null;
        createdAt: string;
        clientName: string | null;
        serviceName: string | null;
      }>,
      CreateQuoteRequest
    >({
      query: quoteData => ({
        url: '/clients/portal/quotes',
        method: 'POST',
        body: quoteData,
      }),
      invalidatesTags: ['Quotes'],
    }),

    updateQuoteStatus: builder.mutation<
      ServerEnvelope<{ id: string; quoteNumber: string; status: ClientPortalQuoteStatus }>,
      { id: string; status: ClientPortalQuoteStatus }
    >({
      query: ({ id, status }) => ({
        url: `/clients/portal/quotes/${id}/status`,
        method: 'PUT',
        body: { status },
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Quotes', id }, 'Quotes'],
    }),

    // Any quote can be deleted; its line items go with it and the client is untouched.
    deleteQuote: builder.mutation<ServerEnvelope<null>, string>({
      query: id => ({
        url: `/clients/portal/quotes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Quotes'],
    }),

    // Copies a quote as a fresh draft issued today.
    duplicateQuote: builder.mutation<
      ServerEnvelope<{ id: string; quoteNumber: string }>,
      string
    >({
      query: id => ({
        url: `/clients/portal/quotes/${id}/duplicate`,
        method: 'POST',
      }),
      invalidatesTags: ['Quotes'],
    }),
  }),
});

export const {
  useGetQuotesQuery,
  useGetQuoteDetailsQuery,
  useCreateQuoteMutation,
  useUpdateQuoteStatusMutation,
  useDeleteQuoteMutation,
  useDuplicateQuoteMutation,
} = clientPortalQuotesApi;
