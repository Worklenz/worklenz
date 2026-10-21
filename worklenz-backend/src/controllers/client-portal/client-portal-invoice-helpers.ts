/**
 * Pure helpers for client portal invoices: totals, line item validation, payment rules and the
 * list's sort/overdue SQL. Kept free of database access so they can be unit tested.
 */

/** Where the invoice is in its lifecycle. `paid` is a legacy value: payment lives in payment_status. */
export const INVOICE_STATUSES = ["draft", "sent", "pending", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** How much of the invoice has been paid; independent of the lifecycle status. */
export const PAYMENT_STATUSES = ["unpaid", "partially_paid", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/** Statuses an admin may set on an invoice. `paid` is deliberately absent: record a payment instead. */
export const isSettableInvoiceStatus = (value: unknown): value is InvoiceStatus =>
  typeof value === "string" && (INVOICE_STATUSES as readonly string[]).includes(value);

export const isPaymentStatus = (value: unknown): value is PaymentStatus =>
  typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);

/**
 * A request can be invoiced once staff have started acting on it. Custom (team-defined) request
 * statuses count too, so this is a deny-list — the same rule as the Requests table's menu.
 */
const NON_INVOICEABLE_REQUEST_STATUSES = ["pending", "rejected"];
export const isInvoiceableRequestStatus = (status: string | null | undefined) =>
  !NON_INVOICEABLE_REQUEST_STATUSES.includes(String(status ?? "").toLowerCase());

export const MAX_LINE_ITEMS = 100;
const MAX_DESCRIPTION_LENGTH = 1000;

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface NormalizedLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/**
 * Validates and normalizes line items from a request body. `amount` is always recomputed from
 * quantity x rate; a client-supplied amount is never trusted.
 */
export function normalizeLineItems(
  raw: unknown
): { items: NormalizedLineItem[]; error?: undefined } | { items?: undefined; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "At least one line item is required" };
  }
  if (raw.length > MAX_LINE_ITEMS) {
    return { error: `An invoice can have at most ${MAX_LINE_ITEMS} line items` };
  }

  const items: NormalizedLineItem[] = [];
  for (const entry of raw) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const description = typeof row.description === "string" ? row.description.trim() : "";
    const quantity = Number(row.quantity);
    const rate = Number(row.rate);

    if (!description) return { error: "Each line item needs a description" };
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return { error: "A line item description is too long" };
    }
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) {
      return { error: "Line item quantity must be a non-negative number" };
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 1_000_000_000) {
      return { error: "Line item rate must be a non-negative number" };
    }

    items.push({
      description,
      quantity: roundMoney(quantity),
      rate: roundMoney(rate),
      amount: roundMoney(quantity * rate),
    });
  }

  if (items.every(item => item.amount <= 0)) {
    return { error: "At least one line item needs an amount greater than 0" };
  }
  return { items };
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

/** Discount never exceeds the subtotal; tax applies to what is left after the discount. */
export function computeInvoiceTotals(
  items: Array<{ amount: number }>,
  discountType: DiscountType,
  discountValue: number,
  taxRate: number
): InvoiceTotals {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
  const rawDiscount =
    discountType === "percentage" ? (subtotal * discountValue) / 100 : discountValue;
  const discountAmount = roundMoney(Math.min(Math.max(rawDiscount, 0), subtotal));
  const taxable = subtotal - discountAmount;
  const taxAmount = roundMoney((taxable * taxRate) / 100);
  return { subtotal, discountAmount, taxAmount, total: roundMoney(taxable + taxAmount) };
}

/** Validated tax / discount inputs from a request body, with defaults. */
export function parseTaxAndDiscount(body: Record<string, unknown>):
  | { taxRate: number; discountType: DiscountType; discountValue: number; error?: undefined }
  | { error: string } {
  const taxRate = body.taxRate === undefined || body.taxRate === null ? 0 : Number(body.taxRate);
  const discountValue =
    body.discountValue === undefined || body.discountValue === null ? 0 : Number(body.discountValue);
  const discountType = (body.discountType ?? "percentage") as string;

  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return { error: "Tax rate must be between 0 and 100" };
  }
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return { error: "Discount must be a non-negative number" };
  }
  if (!(DISCOUNT_TYPES as readonly string[]).includes(discountType)) {
    return { error: "Discount type must be percentage or fixed" };
  }
  if (discountType === "percentage" && discountValue > 100) {
    return { error: "A percentage discount cannot exceed 100" };
  }
  return { taxRate, discountType: discountType as DiscountType, discountValue };
}

/**
 * What Record Payment means: Paid locks Paid Amount to the full invoice amount, Unpaid clears it,
 * Partially Paid keeps the entered amount clamped to [0, amount]. A "partial" payment that
 * covers the whole amount is simply Paid.
 */
export function resolvePayment(
  paymentStatus: PaymentStatus,
  invoiceAmount: number,
  enteredAmount: unknown
): { paymentStatus: PaymentStatus; paidAmount: number } {
  const amount = roundMoney(Math.max(invoiceAmount, 0));
  if (paymentStatus === "paid") return { paymentStatus, paidAmount: amount };
  if (paymentStatus === "unpaid") return { paymentStatus, paidAmount: 0 };

  const entered = Number(enteredAmount);
  const paidAmount = roundMoney(Math.min(Math.max(Number.isFinite(entered) ? entered : 0, 0), amount));
  if (amount > 0 && paidAmount >= amount) return { paymentStatus: "paid", paidAmount: amount };
  return { paymentStatus, paidAmount };
}

/** Sortable list columns (request value -> SQL). Anything else falls back to created_at. */
const INVOICE_SORT_COLUMNS: Record<string, string> = {
  invoice_no: "i.invoice_no",
  client_name: "c.name",
  amount: "i.amount",
  status: "i.status",
  payment_status: "i.payment_status",
  created_at: "i.created_at",
  due_date: "i.due_date",
};

export function buildInvoiceOrderBy(sortBy: unknown, sortOrder: unknown): string {
  const column = INVOICE_SORT_COLUMNS[String(sortBy)] ?? INVOICE_SORT_COLUMNS.created_at;
  const direction = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
  // Ties (and NULL due dates) still come out in a stable, newest-first order.
  return `${column} ${direction} NULLS LAST, i.created_at DESC, i.id`;
}

/**
 * An invoice is overdue once its due date has passed, unless it is fully paid or not yet
 * (or no longer) live. Computed in SQL so it agrees with the database's calendar date.
 */
export const OVERDUE_SQL = `(
  i.due_date IS NOT NULL
  AND i.due_date < CURRENT_DATE
  AND i.payment_status <> 'paid'
  AND i.status NOT IN ('draft', 'cancelled')
)`;

export const clampPagination = (page: unknown, limit: unknown) => {
  const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 100);
  const safePage = Math.max(parseInt(String(page), 10) || 1, 1);
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
};

/** Escapes % and _ so a search term is matched literally inside ILIKE. */
export const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, match => "\\" + match);

/**
 * `undefined` = invalid. A missing/blank value is a valid "no date" (`null`); anything else must
 * be an ISO date or timestamp and is reduced to YYYY-MM-DD.
 */
export function parseOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isRealDate =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
  return isRealDate ? `${year}-${month}-${day}` : undefined;
}

/** Trimmed text or null; over-long text is cut to `max`. */
export function cleanText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

export function normalizeCurrency(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3,10}$/.test(code) ? code : "USD";
}

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

/** Checks a base64 payment-proof upload; returns a message for the first problem, else null. */
export function validatePaymentProof(proof: { fileName?: unknown; fileData?: unknown }): string | null {
  if (typeof proof.fileData !== "string") return "Payment proof data is invalid";
  const match = /^data:([\w/+.-]+);base64,/.exec(proof.fileData);
  if (!match) return "Payment proof must be a base64 data URL";
  if (!ALLOWED_PROOF_TYPES.includes(match[1])) return "Payment proof must be an image or a PDF";
  const payloadLength = proof.fileData.length - match[0].length;
  if (Math.floor((payloadLength * 3) / 4) > MAX_PROOF_BYTES) {
    return "Payment proof must be 10 MB or smaller";
  }
  return null;
}
