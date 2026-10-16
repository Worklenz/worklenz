/**
 * Pure helpers for client portal quotes. Totals, line items, tax / discount, dates and pagination
 * are shared with invoices (see client-portal-invoice-helpers.ts); this file only adds what is
 * specific to quotes: the status lifecycle and the list's sort columns. Kept free of database
 * access so it can be unit tested.
 */

/** Staff set a quote's status by hand; nothing moves it automatically (not even Expired). */
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** A new quote can only start life as a draft, or as already sent ("Create & Download"). */
export const NEW_QUOTE_STATUSES = ["draft", "sent"] as const;

export const isQuoteStatus = (value: unknown): value is QuoteStatus =>
  typeof value === "string" && (QUOTE_STATUSES as readonly string[]).includes(value);

export const isNewQuoteStatus = (value: unknown): value is (typeof NEW_QUOTE_STATUSES)[number] =>
  typeof value === "string" && (NEW_QUOTE_STATUSES as readonly string[]).includes(value);

/** Statuses counted as "Pending" in the stat row (waiting on the client). */
export const PENDING_QUOTE_STATUSES: readonly QuoteStatus[] = ["draft", "sent"];

export const generateQuoteNumber = () =>
  `QUO-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

/** Sortable list columns (request value -> SQL). Anything else falls back to created_at. */
const QUOTE_SORT_COLUMNS: Record<string, string> = {
  quote_no: "q.quote_no",
  client_name: "c.name",
  project_name: "q.project_name",
  amount: "q.amount",
  status: "q.status",
  created_at: "q.created_at",
  valid_until: "q.valid_until",
};

export function buildQuoteOrderBy(sortBy: unknown, sortOrder: unknown): string {
  const column = QUOTE_SORT_COLUMNS[String(sortBy)] ?? QUOTE_SORT_COLUMNS.created_at;
  const direction = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
  // Ties (and NULL Valid Until dates) still come out in a stable, newest-first order.
  return `${column} ${direction} NULLS LAST, q.created_at DESC, q.id`;
}
