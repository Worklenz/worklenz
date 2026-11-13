// Validation for project saved views (#1345). Pure and free of any `db` import so it can be unit
// tested without Postgres. The config is client-supplied JSON that every project member's browser
// later applies to its Task List, so it is checked field by field: unknown keys, wrong types,
// non-UUID ids and oversized payloads are all rejected.
//
// The config shape mirrors the client's serializer
// (worklenz-frontend/src/features/projects/singleProject/saved-views/saved-view-config.ts).

export const SAVED_VIEW_CONFIG_VERSION = 1;
export const SAVED_VIEW_NAME_MAX_LENGTH = 100;
export const SAVED_VIEWS_PER_PROJECT_LIMIT = 50;
export const SAVED_VIEW_BASE_VIEWS = ["tasks-list"] as const;

const MAX_IDS_PER_FILTER = 200;
const MAX_SEARCH_LENGTH = 200;
const GROUPS = ["status", "priority", "phase", "assignee"] as const;
const SORT_ORDERS = ["ASC", "DESC"] as const;
// Sort fields are task list column keys (e.g. "name", "end_date", "priority_value").
const SORT_FIELD_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SavedViewBaseView = (typeof SAVED_VIEW_BASE_VIEWS)[number];

export interface SavedViewConfig {
  version: number;
  priorities: string[];
  statuses: string[];
  phases: string[];
  members: string[];
  labels: string[];
  search: string;
  archived: boolean;
  group: (typeof GROUPS)[number];
  sort_field: string;
  sort_order: (typeof SORT_ORDERS)[number];
}

const CONFIG_KEYS: readonly (keyof SavedViewConfig)[] = [
  "version",
  "priorities",
  "statuses",
  "phases",
  "members",
  "labels",
  "search",
  "archived",
  "group",
  "sort_field",
  "sort_order",
];
const ID_LIST_KEYS = ["priorities", "statuses", "phases", "members", "labels"] as const;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = <T>(error: string): ValidationResult<T> => ({ ok: false, error });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export function validateSavedViewName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return fail("Name is required");
  const name = raw.trim();
  if (!name) return fail("Name is required");
  if (name.length > SAVED_VIEW_NAME_MAX_LENGTH) {
    return fail(`Name must be ${SAVED_VIEW_NAME_MAX_LENGTH} characters or fewer`);
  }
  return { ok: true, value: name };
}

export function validateSavedViewBaseView(raw: unknown): ValidationResult<SavedViewBaseView> {
  if (raw === undefined || raw === null) return { ok: true, value: "tasks-list" };
  if (!isOneOf(SAVED_VIEW_BASE_VIEWS, raw)) return fail("Unsupported view type");
  return { ok: true, value: raw };
}

export function validateSavedViewConfig(raw: unknown): ValidationResult<SavedViewConfig> {
  if (!isPlainObject(raw)) return fail("config must be an object");
  const unknownKey = Object.keys(raw).find(key => !(CONFIG_KEYS as readonly string[]).includes(key));
  if (unknownKey) return fail(`Unknown config field: ${unknownKey}`);

  if (raw.version !== SAVED_VIEW_CONFIG_VERSION) return fail("Unsupported config version");

  const idLists = {} as Record<(typeof ID_LIST_KEYS)[number], string[]>;
  for (const key of ID_LIST_KEYS) {
    const value = raw[key] ?? [];
    if (!Array.isArray(value)) return fail(`config.${key} must be an array`);
    if (value.length > MAX_IDS_PER_FILTER) return fail(`config.${key} has too many values`);
    if (!value.every(item => typeof item === "string" && UUID_PATTERN.test(item))) {
      return fail(`config.${key} must contain only ids`);
    }
    idLists[key] = Array.from(new Set(value as string[]));
  }

  const search = raw.search ?? "";
  if (typeof search !== "string") return fail("config.search must be a string");
  if (search.length > MAX_SEARCH_LENGTH) return fail("config.search is too long");

  const archived = raw.archived ?? false;
  if (typeof archived !== "boolean") return fail("config.archived must be a boolean");

  const group = raw.group ?? "status";
  if (!isOneOf(GROUPS, group)) return fail("config.group is invalid");

  const sortField = raw.sort_field ?? "";
  if (typeof sortField !== "string" || (sortField !== "" && !SORT_FIELD_PATTERN.test(sortField))) {
    return fail("config.sort_field is invalid");
  }

  const sortOrder = raw.sort_order ?? "ASC";
  if (!isOneOf(SORT_ORDERS, sortOrder)) return fail("config.sort_order is invalid");

  return {
    ok: true,
    value: {
      version: SAVED_VIEW_CONFIG_VERSION,
      ...idLists,
      search,
      archived,
      group,
      sort_field: sortField,
      sort_order: sortOrder,
    },
  };
}
