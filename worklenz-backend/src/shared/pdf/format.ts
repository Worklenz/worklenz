import { InvoiceData } from "./types";

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatCurrency = (amount: number, currency = "USD"): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

const STATUS_TEXT: Record<string, string> = {
  paid: "Paid",
  partially_paid: "Partially Paid",
  unpaid: "Unpaid",
  sent: "Sent",
  draft: "Draft",
  overdue: "Overdue",
  cancelled: "Cancelled",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export const getStatusText = (status: string): string => STATUS_TEXT[status] || status;

const NEUTRAL_BADGE = { backgroundColor: "#f5f5f5", color: "#666666" };

const STATUS_BADGE: Record<string, { backgroundColor: string; color: string }> = {
  paid: { backgroundColor: "#f6ffed", color: "#52c41a" },
  partially_paid: { backgroundColor: "#fff7e6", color: "#d46b08" },
  unpaid: { backgroundColor: "#fff2f0", color: "#ff4d4f" },
  sent: { backgroundColor: "#e6f7ff", color: "#1890ff" },
  overdue: { backgroundColor: "#fff2f0", color: "#ff4d4f" },
  draft: NEUTRAL_BADGE,
  cancelled: NEUTRAL_BADGE,
  accepted: { backgroundColor: "#f6ffed", color: "#52c41a" },
  declined: { backgroundColor: "#fff2f0", color: "#ff4d4f" },
  expired: { backgroundColor: "#fff2f0", color: "#ff4d4f" },
};

export const getStatusBadgeColors = (status: string) => STATUS_BADGE[status] || NEUTRAL_BADGE;

export const formatCityStateZip = (
  city?: string | null,
  state?: string | null,
  zipCode?: string | null
): string => {
  const cityState = [city, state].filter(Boolean).join(", ");
  return [cityState, zipCode].filter(Boolean).join(" ");
};

export const getClientAddressParts = (client: InvoiceData["client"]): string[] => {
  const parts: string[] = [];
  if (client.companyName) parts.push(client.companyName);
  if (client.address) parts.push(client.address);
  if (client.email) parts.push(client.email);
  if (client.phone) parts.push(client.phone);
  return parts;
};

/** Accepts only #rgb / #rrggbb so a bad stored value can't break the PDF styles. */
export const safeColor = (value: string | null | undefined, fallback = "#1890ff"): string =>
  value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;

/** Shown in the footer when the organization hasn't set its own invoice footer message. */
export const DEFAULT_FOOTER_MESSAGES: Record<"invoice" | "quote", string> = {
  invoice:
    "Thank you for your business. If you have any questions about this invoice, please contact us using the details above.",
  quote:
    "Thank you for the opportunity to work with you. If you have any questions about this quote, please contact us using the details above.",
};
