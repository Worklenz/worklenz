import path from "path";

export const MAX_SELECTION_OPTIONS = 200;
export const SELECTION_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#14b8a6",
  "#f97316",
  "#f43f5e",
  "#f59e0b",
  "#0ea5e9",
  "#10b981",
];

export const sanitizeSampleValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value);
};

export const isNumericSample = (value: string): boolean => {
  if (!value) return false;
  return Number.isFinite(Number(value));
};

export const countDecimalPlaces = (value: string): number => {
  if (!value.includes(".")) return 0;
  const decimals = value.split(".")[1] || "";
  return Math.min(decimals.length, 6);
};

// Date.parse / new Date() are extremely lenient in V8 and treat issue keys
// like "JAT-1", "PROJ-123", and "MAY-1" as dates. CSV custom-column inference
// must only accept strings that actually look like dates.
const ISSUE_KEY_LIKE_RE = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;
const WEEKDAY_PREFIX = String.raw`(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,?\s+)?`;
const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s*[AP]M)?`;
// Z / UTC / GMT, a numeric offset (+05:30, +0000), or both (GMT+0530), plus the
// "(India Standard Time)" tail that Date#toString() appends.
const TIMEZONE = String.raw`(?:\s*(?:Z|UTC|GMT)?\s*[+-]\d{2}:?\d{2}|\s*(?:Z|UTC|GMT))?(?:\s*\([^)]*\))?`;
const TIME_SUFFIX = String.raw`(?:[T\s]\s*${TIME}${TIMEZONE})?`;
const MONTH_NAME =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DATE_PART = [
  // ISO, zero-padded or not: 2025-03-03, 2025-3-3
  String.raw`\d{4}-\d{1,2}-\d{1,2}`,
  // Numeric: 3/3/2025, 03.03.2025, 2025/03/03, 03-03-2025
  String.raw`\d{1,2}[/.]\d{1,2}[/.]\d{2,4}`,
  String.raw`\d{4}[/.]\d{1,2}[/.]\d{1,2}`,
  String.raw`\d{1,2}-\d{1,2}-\d{4}`,
  // Month names: 01-May-2021, 03/Mar/25, 03 Mar 2025, May 01, 2021
  String.raw`\d{1,2}[/\-\s]${MONTH_NAME}[.,]?[/\-\s]\d{2,4}`,
  String.raw`${MONTH_NAME}[.,]?\s+\d{1,2}(?:,)?\s+\d{2,4}`,
].join("|");
const DATE_LIKE_RE = new RegExp(
  `^${WEEKDAY_PREFIX}(?:${DATE_PART})${TIME_SUFFIX}$`,
  "i",
);

const IDENTIFIER_COLUMN_NAMES = new Set([
  "id",
  "ids",
  "key",
  "issuekey",
  "issueid",
  "ticket",
  "ticketid",
  "taskid",
  "externalid",
  "workitemid",
]);

export const isIdentifierColumnName = (name?: string, key?: string): boolean => {
  const candidates = [name, key]
    .map((value) =>
      (value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, ""),
    )
    .filter(Boolean);
  return candidates.some((value) => IDENTIFIER_COLUMN_NAMES.has(value));
};

export const isDateSample = (value: string): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  if (ISSUE_KEY_LIKE_RE.test(trimmed)) return false;
  if (!DATE_LIKE_RE.test(trimmed)) return false;
  return Number.isFinite(Date.parse(trimmed));
};

/**
 * Parses a date value from an import source. Unlike isDateSample (used to infer
 * whether a whole column is a date), this stays lenient so any format the
 * runtime understands still imports - completed dates, comment and worklog
 * timestamps, and values in columns the user mapped as dates. It only rejects
 * issue-key shaped values ("JAT-1"), which new Date() would otherwise accept.
 */
export const parseImportDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || ISSUE_KEY_LIKE_RE.test(trimmed)) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isBooleanSample = (value: string): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return ["true", "false", "yes", "no", "1", "0"].includes(normalized);
};

export const coerceBooleanValue = (value: string): boolean | null => {
  const normalized = value.toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
};

export const normalizeLabelName = (value: string): string => value.trim();

export const clampText = (value: string, maxLen: number): string =>
  value.length <= maxLen ? value : value.slice(0, Math.max(0, maxLen - 3)) + "...";

export const parseImportedArray = <T>(raw: unknown, key: string): T[] => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const source = raw as Record<string, unknown>;
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item) => !!item && typeof item === "object") as T[];
};

export const safeDate = (value?: string | null): Date | null =>
  parseImportDate(value);

export const normalizeFileExtension = (
  filename?: string | null,
  mimeType?: string | null,
  sourceUrl?: string | null,
): string => {
  const fromName = filename ? path.extname(filename).replace(".", "").toLowerCase() : "";
  if (fromName) return fromName;
  const fromMime = mimeType
    ? mimeType
        .split(";")[0]
        .split("/")
        .pop()
        ?.trim()
        .toLowerCase() || ""
    : "";
  if (fromMime) return fromMime;
  const fromUrl = sourceUrl
    ? path.extname(sourceUrl.split("?")[0]).replace(".", "").toLowerCase()
    : "";
  return fromUrl || "bin";
};

export const parseLabelValues = (
  value: unknown,
  source: Record<string, unknown>,
): string[] => {
  const labels: string[] = [];

  const pushValues = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => {
        if (typeof entry === "string" && entry.trim()) {
          labels.push(entry.trim());
        }
      });
      return;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      candidate
        .split(/[;,]/)
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((part) => labels.push(part));
    }
  };

  pushValues(value);
  // Allow providers to pass richer metadata alongside display strings.
  if (Array.isArray((source as any)?.__labels))
    pushValues((source as any).__labels);
  if (Array.isArray((source as any)?.__labelNames))
    pushValues((source as any).__labelNames);

  // Monday.com specific tag processing
  const tagFields = [
    "Tags_tag_ids",
    "tags_tag_ids",
    "Labels_tag_ids",
    "labels_tag_ids",
    "Tags",
    "tags",
    "Labels",
    "labels",
    "Label", // Monday.com label columns
    "label",
  ];

  tagFields.forEach((fieldName) => {
    const tagValue = source[fieldName];
    pushValues(tagValue);
  });

  // Look for _raw tag data
  Object.keys(source).forEach((key) => {
    if (key.toLowerCase().includes("tag") && key.includes("_raw")) {
      const tagData = source[key];
      if (typeof tagData === "object" && tagData && (tagData as any).tags) {
        const tags = (tagData as any).tags;
        if (Array.isArray(tags)) {
          tags.forEach((tag) => {
            if (tag && tag.name) {
              pushValues(tag.name);
            }
          });
        }
      }
    }
  });

  // Monday.com status-based label processing
  Object.keys(source).forEach((key) => {
    if (
      key.toLowerCase().includes("label") ||
      (key.startsWith("color_") && source[key])
    ) {
      const labelValue = source[key];
      pushValues(labelValue);
    }
  });

  // Additional Monday.com label extraction
  // Check for direct Label fields (Label, Label1, Label2, etc.)
  Object.keys(source).forEach((key) => {
    if (key.match(/^Label\d*$/i) && source[key]) {
      pushValues(source[key]);
    }
  });

  return Array.from(new Set(labels.map(normalizeLabelName))).filter(Boolean);
};
