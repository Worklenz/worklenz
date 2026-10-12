import moment from "moment";
import sanitizeHtml from "sanitize-html";
import { TaskExportNamedRef } from "./types";

const DATE_ONLY_FORMAT = "YYYY-MM-DD";
const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

/**
 * Strips HTML tags and decodes common entities for CSV-friendly plain text.
 */
export const stripHtmlToPlainText = (value: string | null | undefined): string => {
  if (!value) return "";

  const decodedValue = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Decode ampersands last so already-encoded entities are decoded only once.
    .replace(/&amp;/gi, "&");

  const textWithLineBreaks = decodedValue
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n");

  return sanitizeHtml(textWithLineBreaks, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Comments store @mentions as `{0}`, `{1}`, … placeholders.
 * Replace them with `@Display Name` using the ordered mentions list
 * (same contract as TaskCommentsController when serving the UI).
 */
export const resolveCommentMentionPlaceholders = (
  content: string | null | undefined,
  mentions?: Array<{ user_name?: string | null } | string> | null
): string => {
  if (!content) return "";
  if (!mentions || mentions.length === 0) return content;

  const names = mentions.map((mention) =>
    typeof mention === "string" ? mention : mention?.user_name || ""
  );

  return content.replace(/\{(\d+)\}/g, (placeholder, indexText: string) => {
    const index = Number.parseInt(indexText, 10);
    if (Number.isNaN(index) || index < 0 || index >= names.length) {
      return placeholder;
    }
    const name = names[index]?.trim();
    if (!name) return placeholder;
    return `@${name}`;
  });
};

/** Comma-separated attachment filenames for the Comments CSV Attachments column. */
export const formatCommentAttachmentNames = (
  names?: string[] | null
): string => {
  if (!names || names.length === 0) return "";
  return names
    .map((name) => (name || "").trim())
    .filter(Boolean)
    .join(", ");
};

export const formatExportDate = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  // UTC so exports are stable regardless of server timezone.
  const parsed = moment.utc(value);
  if (!parsed.isValid()) return "";
  return parsed.format(DATE_ONLY_FORMAT);
};

export const formatExportDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const parsed = moment.utc(value);
  if (!parsed.isValid()) return "";
  return parsed.format(DATE_TIME_FORMAT);
};

/**
 * Formats estimated minutes as `Xh Ym` (matches reporting export style).
 */
export const formatMinutesAsDuration = (minutesValue: number | string | null | undefined): string => {
  const totalMinutes = Math.max(0, Math.floor(Number(minutesValue) || 0));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

/**
 * Formats logged seconds as `Xh Ym`.
 */
export const formatSecondsAsDuration = (secondsValue: number | string | null | undefined): string => {
  const totalSeconds = Math.max(0, Math.floor(Number(secondsValue) || 0));
  const totalMinutes = Math.ceil(totalSeconds / 60);
  return formatMinutesAsDuration(totalMinutes);
};

export const formatYesNo = (value: boolean | null | undefined): string => {
  return value ? "Y" : "N";
};

export const formatProgressPercent = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return String(numeric);
};

const resolveNamedRef = (item: TaskExportNamedRef | string): string => {
  if (typeof item === "string") return item.trim();
  return (item?.name || "").trim();
};

export const formatNamedList = (
  items: Array<TaskExportNamedRef | string> | null | undefined
): string => {
  if (!items || !Array.isArray(items) || items.length === 0) return "";
  return items
    .map(resolveNamedRef)
    .filter((name) => name.length > 0)
    .join(", ");
};

/**
 * Formats a custom-column value for CSV.
 * People / selection JSON arrays become comma-separated names or string values.
 */
export const formatCustomFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";

  if (typeof value === "boolean") {
    return value ? "Y" : "N";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "string") {
    // Date-like ISO strings from jsonb → date-only when valid date-only/timestamp
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const asDate = formatExportDate(value);
      if (asDate) return asDate;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry === null || entry === undefined) return "";
        if (typeof entry === "string" || typeof entry === "number") {
          return String(entry);
        }
        if (typeof entry === "object") {
          const record = entry as Record<string, unknown>;
          const name =
            (typeof record.name === "string" && record.name) ||
            (typeof record.label === "string" && record.label) ||
            (typeof record.email === "string" && record.email) ||
            "";
          return name || JSON.stringify(entry);
        }
        return String(entry);
      })
      .filter((part) => part.length > 0)
      .join(", ");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string") return record.name;
    if (typeof record.label === "string") return record.label;
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value);
};
