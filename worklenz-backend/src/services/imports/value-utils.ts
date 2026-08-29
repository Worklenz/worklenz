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

export const isDateSample = (value: string): boolean => {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
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

export const safeDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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
