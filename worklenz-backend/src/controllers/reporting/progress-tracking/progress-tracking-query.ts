export const CONFIDENCE_FILTERS = ["green", "amber", "red", "unset"] as const;
export const PERCENT_RANGE_FILTERS = ["no_tasks", "0_25", "26_50", "51_75", "76_100"] as const;
export const SORT_FIELDS = ["name", "client", "percent", "blocked", "confidence", "updated"] as const;
export const DELIVERY_CONFIDENCE_NOTE_MAX = 280;

export type DeliveryConfidenceStatus = "green" | "amber" | "red";

export interface ProgressTrackingListInput {
  search?: string;
  confidence?: string;
  percentRange?: string;
  hasBlockers?: boolean;
  sortField?: string;
  sortOrder?: string;
}

export interface ProgressTrackingListQuery {
  whereSql: string;
  orderBySql: string;
  params: unknown[];
}

const SORT_COLUMNS: Record<(typeof SORT_FIELDS)[number], string> = {
  name: "name",
  client: "client_name",
  percent: "percent_complete",
  blocked: "blocked_count",
  confidence: "confidence_rank",
  updated: "confidence_updated_at",
};

/** Order used when the client sends no sort, so cleared sorts do not fall back to a name sort. */
export const UNSORTED_ORDER_BY = "created_at DESC, id ASC";

const encodeForStoredText = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const normalizeSortField = (field: string | undefined): (typeof SORT_FIELDS)[number] | null => {
  if (field && (SORT_FIELDS as readonly string[]).includes(field)) {
    return field as (typeof SORT_FIELDS)[number];
  }
  return null;
};

const normalizeSortOrder = (order: string | undefined): "ASC" | "DESC" => {
  const value = (order || "").toLowerCase();
  if (value === "desc" || value === "descend") return "DESC";
  return "ASC";
};

/**
 * Builds the filter and sort clauses for the portfolio list.
 * Column names come from a fixed map. User text is only bound as parameters.
 */
export const buildProgressTrackingListQuery = (
  input: ProgressTrackingListInput,
  paramStart: number
): ProgressTrackingListQuery => {
  const clauses: string[] = ["TRUE"];
  const params: unknown[] = [];
  let paramIndex = paramStart;

  const search = (input.search || "").trim();
  if (search) {
    const rawPattern = `%${escapeLike(search)}%`;
    const encoded = encodeForStoredText(search);
    const encodedPattern = encoded === search ? null : `%${escapeLike(encoded)}%`;

    if (encodedPattern) {
      clauses.push(
        `(name ILIKE $${paramIndex} ESCAPE '\\' OR COALESCE(client_name, '') ILIKE $${paramIndex} ESCAPE '\\' OR name ILIKE $${paramIndex + 1} ESCAPE '\\' OR COALESCE(client_name, '') ILIKE $${paramIndex + 1} ESCAPE '\\')`
      );
      params.push(rawPattern, encodedPattern);
      paramIndex += 2;
    } else {
      clauses.push(
        `(name ILIKE $${paramIndex} ESCAPE '\\' OR COALESCE(client_name, '') ILIKE $${paramIndex} ESCAPE '\\')`
      );
      params.push(rawPattern);
      paramIndex += 1;
    }
  }

  if (input.confidence && (CONFIDENCE_FILTERS as readonly string[]).includes(input.confidence)) {
    if (input.confidence === "unset") {
      clauses.push("confidence IS NULL");
    } else {
      clauses.push(`confidence = $${paramIndex}`);
      params.push(input.confidence);
      paramIndex += 1;
    }
  }

  if (input.percentRange && (PERCENT_RANGE_FILTERS as readonly string[]).includes(input.percentRange)) {
    if (input.percentRange === "no_tasks") {
      clauses.push("percent_complete IS NULL");
    } else if (input.percentRange === "0_25") {
      clauses.push("percent_complete BETWEEN 0 AND 25");
    } else if (input.percentRange === "26_50") {
      clauses.push("percent_complete BETWEEN 26 AND 50");
    } else if (input.percentRange === "51_75") {
      clauses.push("percent_complete BETWEEN 51 AND 75");
    } else {
      clauses.push("percent_complete BETWEEN 76 AND 100");
    }
  }

  if (input.hasBlockers) {
    clauses.push("blocked_count > 0");
  }

  const sortField = normalizeSortField(input.sortField);
  const orderBySql = sortField
    ? `${SORT_COLUMNS[sortField]} ${normalizeSortOrder(input.sortOrder)} NULLS LAST, name ASC`
    : UNSORTED_ORDER_BY;

  return {
    whereSql: clauses.join(" AND "),
    orderBySql,
    params,
  };
};

export const parseDeliveryConfidenceStatus = (
  value: unknown
): { ok: true; status: DeliveryConfidenceStatus | null } | { ok: false } => {
  if (value === null || value === "unset" || value === "") {
    return { ok: true, status: null };
  }
  if (value === "green" || value === "amber" || value === "red") {
    return { ok: true, status: value };
  }
  return { ok: false };
};

export const parseDeliveryConfidenceNote = (
  value: unknown
): { ok: true; note: string | null } | { ok: false } => {
  if (value === null || value === "") return { ok: true, note: null };
  if (typeof value !== "string") return { ok: false };

  const cleaned = value.replace(/<[^>]*>/g, "").trim();
  if ([...cleaned].length > DELIVERY_CONFIDENCE_NOTE_MAX) return { ok: false };
  return { ok: true, note: cleaned.length > 0 ? cleaned : null };
};
