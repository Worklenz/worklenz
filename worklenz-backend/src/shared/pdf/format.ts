import { InvoiceData } from "./types";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  // A date-only value is a calendar day, not an instant: build it locally so a server west of UTC doesn't show the day before.
  const dateOnly = DATE_ONLY.exec(dateString);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const HTML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/** Turns the sanitized rich-text notes HTML into plain text for a PDF <Text> node. */
export const htmlToPlainText = (html: string | null | undefined): string => {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|ul|ol|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, entity: string) => HTML_ENTITIES[entity])
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
