import db from "../config/db";
import { PoolClient } from "pg";
import slugify from "slugify";
import axios from "axios";
import path from "path";
import { getKey, uploadBuffer } from "../shared/storage";
import { EncryptionService } from "./encryption.service";

export type ImportFlowType = "direct" | "csv";
export type ImportStatus =
  | "pending"
  | "ready"
  | "running"
  | "success"
  | "failed";

export interface CreateImportJobInput {
  provider: string;
  flowType: ImportFlowType;
  createdBy: string;
  targetProjectId?: string;
  targetSpaceType?: string;
  targetTemplate?: string;
  sourceReference?: Record<string, unknown>;
}

export interface ImportJob {
  id: string;
  provider: string;
  flow_type: ImportFlowType;
  status: ImportStatus;
  current_step: number;
  created_by: string;
  target_project_id: string | null;
  target_space_type: string | null;
  target_template: string | null;
  source_reference: Record<string, unknown> | null;
  stats: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValueMappingRow {
  source_value: string;
  target_worktype: string;
  include?: boolean;
}

export interface UserMappingRow {
  source_user_id?: string | null;
  source_email?: string | null;
  target_user_id?: string | null;
  resolution?: string;
  include?: boolean;
}

export interface AttachmentPlanRow {
  source_url: string;
  filename?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  status?: string;
  storage_key?: string | null;
}

export interface StageTaskRow {
  source_task_id?: string | null;
  parent_source_task_id?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  due_at?: string | null;
  start_at?: string | null;
  worktype?: string | null;
  assignee_source_id?: string | null;
  attachments_planned?: boolean;
  raw?: unknown;
}

export interface FieldMappingRow {
  source_field: string;
  target_field: string;
  required?: boolean;
  include?: boolean;
}

export interface TaskFieldPatch {
  title?: string;
  description?: string | null;
  status?: string | null;
  start_at?: string | null;
  due_at?: string | null;
  assignee_source_id?: string | null;
  labels?: string[] | null;
  priority_label?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CustomFieldValuePlan {
  columnKey: string;
  columnName: string;
  value: unknown;
}

interface ImportedJiraComment {
  author?: string;
  authorDisplayName?: string | null;
  authorEmail?: string | null;
  authorAccountId?: string | null;
  created?: string | null;
  body?: string;
}

interface ImportedJiraWorklog {
  author?: string;
  started?: string | null;
  created?: string | null;
  timeSpent?: string;
  timeSpentSeconds?: number;
  comment?: string;
}

interface ImportedJiraAttachment {
  filename?: string;
  url?: string;
  mimeType?: string | null;
  size?: number | null;
  created?: string | null;
  author?: string;
}

type SupportedCustomFieldType =
  | "people"
  | "text"
  | "number"
  | "date"
  | "selection"
  | "checkbox"
  | "labels"
  | "key"
  | "formula";

interface SelectionOptionPlan {
  id: string;
  name: string;
  color: string;
}

interface ColumnPlanConfig {
  fieldType: SupportedCustomFieldType;
  numberType?: string | null;
  decimals?: number | null;
  selections?: SelectionOptionPlan[];
  valueToSelectionId?: Map<string, string>;
}

interface CustomColumnPlan {
  key: string;
  name: string;
  sourceField: string;
  samples: Set<string>;
}

interface CustomColumnRef {
  id: string;
  key: string;
  fieldType?: SupportedCustomFieldType;
}

const MAX_SELECTION_OPTIONS = 200;
const SELECTION_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#14b8a6",
  "#f97316",
  "#f43f5e",
  "#f59e0b",
  "#0ea5e9",
  "#10b981",
];

const sanitizeSampleValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value);
};

const isNumericSample = (value: string): boolean => {
  if (!value) return false;
  return Number.isFinite(Number(value));
};

const countDecimalPlaces = (value: string): number => {
  if (!value.includes(".")) return 0;
  const decimals = value.split(".")[1] || "";
  return Math.min(decimals.length, 6);
};

const isDateSample = (value: string): boolean => {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
};

const isBooleanSample = (value: string): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return ["true", "false", "yes", "no", "1", "0"].includes(normalized);
};

const coerceBooleanValue = (value: string): boolean | null => {
  const normalized = value.toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
};

const normalizeLabelName = (value: string): string => value.trim();

const clampText = (value: string, maxLen: number): string =>
  value.length <= maxLen ? value : value.slice(0, Math.max(0, maxLen - 3)) + "...";

const parseImportedArray = <T>(
  raw: unknown,
  key: string
): T[] => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const source = raw as Record<string, unknown>;
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item) => !!item && typeof item === "object") as T[];
};

const safeDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeFileExtension = (
  filename?: string | null,
  mimeType?: string | null,
  sourceUrl?: string | null
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

const parseLabelValues = (
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

// Create custom columns from Monday.com custom fields
const createCustomColumnFromMondayField = async (
  projectId: string,
  column: { id: string; title: string; type: string; settings_str?: string },
  db: any,
): Promise<string | null> => {
  try {
    // Map Monday.com column types to Worklenz custom field types
    const typeMapping: Record<
      string,
      { fieldType: string; numberType?: string }
    > = {
      numbers: { fieldType: "number", numberType: "formatted" },
      numeric: { fieldType: "number", numberType: "formatted" },
      dropdown: { fieldType: "selection" },
      text: { fieldType: "text" }, // Use text type for text fields instead of people
      timeline: { fieldType: "date" },
      date: { fieldType: "date" },
      checkbox: { fieldType: "checkbox" },
    };

    const mapping = typeMapping[column.type];
    if (!mapping) {
      return null;
    }

    const columnKey = `monday_${column.id}_${column.type}`;
    const columnName = column.title || `Monday ${column.type}`;

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Insert the main custom column
      const columnQuery = `
        INSERT INTO cc_custom_columns (
          project_id, name, key, field_type, width, is_visible, is_custom_column
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id;
      `;
      const columnResult = await client.query(columnQuery, [
        projectId,
        columnName,
        columnKey,
        mapping.fieldType,
        150, // Default width
        true, // Visible by default
      ]);
      const columnId = columnResult.rows[0].id;

      // 2. Insert the column configuration
      const configQuery = `
        INSERT INTO cc_column_configurations (
          column_id, field_title, field_type, number_type, 
          decimals, label, label_position, preview_value
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
      `;
      await client.query(configQuery, [
        columnId,
        columnName,
        mapping.fieldType,
        mapping.numberType || null,
        mapping.fieldType === "number" ? 2 : null, // Default 2 decimals for numbers
        mapping.fieldType === "number" ? "" : null, // No label for now
        mapping.fieldType === "number" ? "left" : null,
        mapping.fieldType === "number" ? 0 : null,
      ]);

      // 3. For dropdown fields, create selection options
      if (mapping.fieldType === "selection" && column.settings_str) {
        try {
          const settings = JSON.parse(column.settings_str);
          if (settings.labels && Array.isArray(settings.labels)) {
            const selectionQuery = `
              INSERT INTO cc_selection_options (
                column_id, selection_id, selection_name, selection_color, selection_order
              ) VALUES ($1, $2, $3, $4, $5);
            `;
            for (const [index, label] of settings.labels.entries()) {
              const labelId = typeof label === "object" ? label.id : index;
              const labelName =
                typeof label === "object" ? label.name : String(label);
              const labelColor =
                typeof label === "object" ? label.color : "#3498db";

              await client.query(selectionQuery, [
                columnId,
                String(labelId),
                labelName,
                labelColor,
                index,
              ]);
            }
          }
        } catch (parseError) {
          console.log(
            `[Monday Custom Column] Failed to parse settings for dropdown:`,
            parseError,
          );
        }
      }

      await client.query("COMMIT");
      return columnKey;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`[Monday Custom Column] Failed to create column:`, error);
      return null;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      `[Monday Custom Column] Error creating custom column:`,
      error,
    );
    return null;
  }
};

const collectAssigneeCandidates = (
  value: unknown,
  source: Record<string, unknown>,
): string[] => {
  const candidates: string[] = [];

  const push = (candidate?: string | null) => {
    if (candidate && candidate.trim()) {
      candidates.push(candidate.trim());
    }
  };

  const pushValue = (entry: unknown) => {
    if (entry === null || entry === undefined) return;
    if (typeof entry === "string") {
      push(entry);
      return;
    }
    const coerced = String(entry);
    if (coerced) push(coerced);
  };

  if (Array.isArray(value)) {
    value.forEach(pushValue);
  } else if (typeof value === "string" && value.trim()) {
    value
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach(push);
  }

  const rawMembers = (source as any).__memberIds as unknown[] | undefined;
  const rawNames = (source as any).__memberNames as unknown[] | undefined;
  const rawEmails = (source as any).__memberEmails as unknown[] | undefined;

  (rawEmails || []).forEach(pushValue);
  (rawMembers || []).forEach(pushValue);
  (rawNames || []).forEach(pushValue);

  // Monday.com specific email extraction from enhanced fields
  const mondayEmailFields = [
    "Person_emails",
    "Assignee_emails",
    "person_emails",
    "assignee_emails",
    "People_emails",
    "Owner_emails",
  ];

  mondayEmailFields.forEach((fieldName) => {
    const emailValue = source[fieldName];
    if (emailValue && typeof emailValue === "string" && emailValue.trim()) {
      emailValue
        .split(/[,;]/)
        .map((email) => email.trim())
        .filter(Boolean)
        .forEach(push);
    }
  });

  // Also check for name fields from Monday.com
  const mondayNameFields = [
    "Person_names",
    "Assignee_names",
    "person_names",
    "assignee_names",
    "People_names",
    "Owner_names",
  ];

  mondayNameFields.forEach((fieldName) => {
    const nameValue = source[fieldName];
    if (nameValue && typeof nameValue === "string" && nameValue.trim()) {
      nameValue
        .split(/[,;]/)
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach(push);
    }
  });

  return Array.from(new Set(candidates));
};

const pickBestAssignee = (
  candidates: string[],
  current?: string | null,
): string | null => {
  if (!candidates.length) return current || null;
  const hasEmail = candidates.find((c) => c.includes("@"));
  if (hasEmail) return hasEmail;
  return candidates[0] || current || null;
};

const buildSelectionOptions = (
  plan: CustomColumnPlan,
  values: string[],
): { selections: SelectionOptionPlan[]; map: Map<string, string> } => {
  const uniqueValues = Array.from(new Set(values)).slice(
    0,
    MAX_SELECTION_OPTIONS,
  );
  const selections = uniqueValues.map((value, index) => {
    const slug =
      slugify(value, { lower: true, strict: true }).slice(0, 40) ||
      `option-${index}`;
    return {
      id: `${plan.key}-${slug}-${index}`,
      name: value,
      color: SELECTION_COLORS[index % SELECTION_COLORS.length],
    };
  });
  const map = new Map<string, string>();
  selections.forEach((selection) => {
    map.set(selection.name, selection.id);
  });
  return { selections, map };
};

const inferColumnConfig = (plan: CustomColumnPlan): ColumnPlanConfig => {
  const values = Array.from(plan.samples).filter((value) => !!value);

  // Special handling for location fields - create as labels type for text display
  if (
    plan.name.toLowerCase().includes("location") ||
    plan.key.includes("location")
  ) {
    return { fieldType: "labels" };
  }

  if (values.length && values.every(isNumericSample)) {
    const decimals = values.reduce(
      (acc, value) => Math.max(acc, countDecimalPlaces(value)),
      0,
    );
    return { fieldType: "number", numberType: "formatted", decimals };
  }

  if (values.length && values.every(isDateSample)) {
    return { fieldType: "date" };
  }

  if (values.length && values.every(isBooleanSample)) {
    return { fieldType: "checkbox" };
  }

  // Default to text type for general text data instead of selection
  // Only use selection type when there are clear distinct options
  if (values.length > 0 && values.length <= 50) {
    const uniqueValues = [...new Set(values)];
    // Only create selection if there are reasonable number of distinct options
    // and the ratio suggests categorical data (not unique text)
    if (
      uniqueValues.length <= 10 &&
      uniqueValues.length / values.length <= 0.5
    ) {
      const { selections, map } = buildSelectionOptions(plan, values);
      return {
        fieldType: "selection",
        selections,
        valueToSelectionId: map,
      };
    }
  }

  // Default to text type for most text data
  return { fieldType: "text" };
};

const STANDARD_TARGET_FIELDS = new Set<string>([
  "key",
  "description",
  "progress",
  "status",
  "assignees",
  "labels",
  "phase",
  "priority",
  "timeTracking",
  "estimation",
  "startDate",
  "dueDate",
  "completedDate",
  "createdDate",
  "lastUpdated",
  "reporter",
]);

const TARGET_FIELD_ALIASES: Record<string, string> = {
  key: "key",
  title: "key",
  name: "key",
  task: "key",
  taskname: "key",
  tasktitle: "key",
  summary: "key",
  description: "description",
  progress: "progress",
  status: "status",
  assignee: "assignees",
  assignees: "assignees",
  member: "assignees",
  members: "assignees",
  label: "labels",
  labels: "labels",
  phase: "phase",
  priority: "priority",
  timetracking: "timeTracking",
  estimation: "estimation",
  estimate: "estimation",
  startdate: "startDate",
  start: "startDate",
  startat: "startDate",
  startatdate: "startDate",
  duedate: "dueDate",
  due: "dueDate",
  dueat: "dueDate",
  completeddate: "completedDate",
  completed: "completedDate",
  completedat: "completedDate",
  createddate: "createdDate",
  created: "createdDate",
  createdat: "createdDate",
  lastupdated: "lastUpdated",
  updated: "lastUpdated",
  updatedat: "lastUpdated",
  reporter: "reporter",
  owner: "reporter",
  location: "location",
};

const normalizeTargetField = (value: string) => {
  const normalized = slugify(value || "", {
    lower: true,
    strict: true,
  }).replace(/-/g, "");
  return TARGET_FIELD_ALIASES[normalized] || value;
};

const toColumnKey = (value: string) =>
  slugify(value || "custom-column", { lower: true, strict: true }) ||
  "custom-column";

const normalizeRawFieldName = (value?: string | null) =>
  slugify(value || "", { lower: true, strict: true }).replace(/-/g, "");

const getNormalizedFieldValue = (
  source: Record<string, unknown>,
  candidates: string[],
) => {
  if (!candidates?.length) return null;

  for (const candidate of candidates) {
    if (
      Object.prototype.hasOwnProperty.call(source, candidate) &&
      source[candidate] !== undefined &&
      source[candidate] !== null &&
      source[candidate] !== ""
    ) {
      return source[candidate];
    }
  }

  const normalizedEntries = Object.entries(source).map(([key, value]) => ({
    key: normalizeRawFieldName(key),
    value,
  }));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeRawFieldName(candidate);
    const match = normalizedEntries.find(
      (entry) => entry.key === normalizedCandidate,
    );
    if (
      match &&
      match.value !== undefined &&
      match.value !== null &&
      match.value !== ""
    ) {
      return match.value;
    }
  }

  return null;
};

export const mapRawToTaskFields = (
  raw: unknown,
  mappings: FieldMappingRow[],
): { patch: TaskFieldPatch; customValues: CustomFieldValuePlan[] } => {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const patch: TaskFieldPatch = {};
  const customValues: CustomFieldValuePlan[] = [];

  const pushCustomValue = (
    columnKey: string,
    columnName: string,
    value: unknown,
  ) => {
    customValues.push({ columnKey, columnName, value });
  };

  mappings.forEach((mapping) => {
    if (mapping.include === false) return;

    // Skip standard custom field mappings for Monday imports when Monday-specific mappings exist
    if (
      mapping.target_field &&
      mappings.some((m) => m.target_field?.startsWith("monday_"))
    ) {
      const standardCustomFieldTypes = [
        "dropdown",
        "text",
        "cost",
        "timeline",
        "checkbox",
      ];
      if (
        standardCustomFieldTypes.includes(mapping.target_field.toLowerCase())
      ) {
        return;
      }
    }

    const value = getNormalizedFieldValue(source, [mapping.source_field]);

    if (value === undefined || value === null || value === "") return;

    const targetField = normalizeTargetField(mapping.target_field);

    switch (targetField) {
      case "key": {
        const normalized = String(value).trim();
        if (normalized) {
          patch.title = normalized;
        }
        break;
      }
      case "description":
        patch.description = String(value);
        break;
      case "status":
        patch.status = String(value);
        break;
      case "startDate":
        // Handle Monday.com timeline data - check for _start suffix first
        if (mapping.source_field?.includes("_start")) {
          patch.start_at = String(value);
        } else if (source[`${mapping.source_field}_raw`]) {
          const timelineData = source[`${mapping.source_field}_raw`];
          if (
            typeof timelineData === "object" &&
            timelineData &&
            (timelineData as any).from
          ) {
            patch.start_at = String((timelineData as any).from);
          } else {
            patch.start_at = String(value);
          }
        } else if (source[`${mapping.source_field}_start`]) {
          patch.start_at = String(source[`${mapping.source_field}_start`]);
        } else {
          patch.start_at = String(value);
        }
        break;
      case "dueDate":
        // Handle Monday.com timeline data and regular dates - check for _end suffix first
        if (mapping.source_field?.includes("_end")) {
          patch.due_at = String(value);
        } else if (source[`${mapping.source_field}_raw`]) {
          const timelineData = source[`${mapping.source_field}_raw`];
          if (
            typeof timelineData === "object" &&
            timelineData &&
            (timelineData as any).to
          ) {
            patch.due_at = String((timelineData as any).to);
          } else if (
            typeof timelineData === "object" &&
            timelineData &&
            (timelineData as any).date
          ) {
            patch.due_at = String((timelineData as any).date);
          } else {
            patch.due_at = String(value);
          }
        } else if (source[`${mapping.source_field}_end`]) {
          patch.due_at = String(source[`${mapping.source_field}_end`]);
        } else {
          patch.due_at = String(value);
        }
        break;
      case "createdDate":
        patch.created_at = String(value);
        break;
      case "lastUpdated":
        patch.updated_at = String(value);
        break;
      case "assignees": {
        const candidates = collectAssigneeCandidates(value, source);
        const selected = pickBestAssignee(candidates, patch.assignee_source_id);
        if (selected) {
          patch.assignee_source_id = selected;
        }
        break;
      }
      case "priority":
        patch.priority_label = String(value);
        break;
      case "completedDate":
        patch.completed_at = String(value);
        break;
      case "labels": {
        const parsedLabels = parseLabelValues(value, source);
        if (parsedLabels.length) {
          patch.labels = Array.from(
            new Set([...(patch.labels || []), ...parsedLabels]),
          );
        }
        break;
      }
      case "progress": {
        pushCustomValue(
          toColumnKey("progress"),
          mapping.source_field || "Progress",
          value,
        );
        break;
      }
      case "timetracking": {
        pushCustomValue(
          toColumnKey("timeTracking"),
          mapping.source_field || "Time Tracking",
          value,
        );
        break;
      }
      case "estimation": {
        pushCustomValue(
          toColumnKey("estimation"),
          mapping.source_field || "Estimation",
          value,
        );
        break;
      }
      case "reporter": {
        pushCustomValue(
          toColumnKey("reporter"),
          mapping.source_field || "Reporter",
          value,
        );
        break;
      }
      case "location": {
        pushCustomValue(
          toColumnKey("location"),
          mapping.source_field || "Location",
          value,
        );
        break;
      }
      default: {
        const columnKey = toColumnKey(targetField);
        const columnName = mapping.source_field || targetField;
        pushCustomValue(columnKey, columnName, value);
        break;
      }
    }
  });

  // Fallbacks: if mapping was missing but raw still carries common date fields
  if (!patch.created_at) {
    const rawCreated =
      (source as any)?.Created ??
      (source as any)?.created ??
      (source as any)?.created_at ??
      (source as any)?.createdDate ??
      getNormalizedFieldValue(source, [
        "Created at",
        "created at",
        "Created on",
        "created on",
        "Created date",
        "created date",
        "date created",
      ]);
    if (rawCreated) {
      patch.created_at = String(rawCreated);
    }
  }

  if (!patch.updated_at) {
    const rawUpdated =
      (source as any)?.Updated ??
      (source as any)?.updated ??
      (source as any)?.updated_at ??
      (source as any)?.updatedDate ??
      (source as any)?.lastUpdated ??
      getNormalizedFieldValue(source, [
        "Updated at",
        "updated at",
        "Updated on",
        "updated on",
        "Last updated",
        "last updated",
        "Modified",
        "modified",
        "modified at",
        "modified on",
      ]);
    if (rawUpdated) {
      patch.updated_at = String(rawUpdated);
    }
  }

  return { patch, customValues };
};

class ImportsService {
  async createJob(input: CreateImportJobInput): Promise<ImportJob> {
    const q = `INSERT INTO import_jobs (
                 provider,
                 flow_type,
                 created_by,
                 target_project_id,
                 target_space_type,
                 target_template,
                 source_reference
               )
               VALUES ($1::text,$2::text,$3::uuid,$4::uuid,$5::text,$6::text,$7::jsonb)
               RETURNING *;`;
    const params = [
      input.provider,
      input.flowType,
      input.createdBy,
      input.targetProjectId || null,
      input.targetSpaceType || null,
      input.targetTemplate || null,
      input.sourceReference || null,
    ];
    const { rows } = await db.query(q, params);
    return rows[0];
  }

  async getJob(jobId: string): Promise<ImportJob | null> {
    const { rows } = await db.query("SELECT * FROM import_jobs WHERE id = $1", [
      jobId,
    ]);
    return rows[0] || null;
  }

  async getJobForUser(
    jobId: string,
    userId?: string | null,
  ): Promise<ImportJob | null> {
    if (!userId) return null;
    const { rows } = await db.query(
      "SELECT * FROM import_jobs WHERE id = $1 AND created_by = $2",
      [jobId, userId],
    );
    return rows[0] || null;
  }

  async mergeSourceReference(jobId: string, patch: Record<string, unknown>) {
    // Merge JSONB while preserving existing data
    await db.query(
      `UPDATE import_jobs
       SET source_reference = COALESCE(source_reference, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, patch],
    );
  }

  async updateJobStatus(
    jobId: string,
    status: ImportStatus,
    errorMessage?: string | null,
    stats?: Record<string, unknown>,
  ) {
    await db.query(
      "UPDATE import_jobs SET status = $2, error_message = $3, stats = COALESCE($4, stats), updated_at = NOW() WHERE id = $1",
      [jobId, status, errorMessage || null, stats || null],
    );
  }

  async updateJobTargets(
    jobId: string,
    targetProjectId?: string | null,
    targetSpaceType?: string | null,
    targetTemplate?: string | null,
  ) {
    await db.query(
      `UPDATE import_jobs
         SET target_project_id = COALESCE($2, target_project_id),
             target_space_type = COALESCE($3, target_space_type),
             target_template   = COALESCE($4, target_template),
             updated_at        = NOW()
       WHERE id = $1`,
      [
        jobId,
        targetProjectId || null,
        targetSpaceType || null,
        targetTemplate || null,
      ],
    );
  }

  async appendLog(
    jobId: string,
    level: string,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    await db.query(
      "INSERT INTO import_logs (job_id, level, message, context) VALUES ($1,$2,$3,$4)",
      [jobId, level, message, context],
    );
  }

  async upsertHierarchy(
    jobId: string,
    rows: Array<{
      source_level: string;
      target_level: string;
      position: number;
    }>,
  ) {
    await db.query("DELETE FROM import_hierarchy_mappings WHERE job_id = $1", [
      jobId,
    ]);
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4})`,
      );
      params.push(row.source_level, row.target_level, row.position);
    });
    if (rows.length) {
      await db.query(
        `INSERT INTO import_hierarchy_mappings (job_id, source_level, target_level, position)
         VALUES ${insertValues.join(",")}`,
        [jobId, ...params],
      );
    }
  }

  async upsertFields(
    jobId: string,
    rows: Array<{
      source_field: string;
      target_field: string;
      required?: boolean;
      include?: boolean;
    }>,
  ) {
    await db.query("DELETE FROM import_field_mappings WHERE job_id = $1", [
      jobId,
    ]);
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4}, $${
          idx * 4 + 5
        })`,
      );
      params.push(
        row.source_field,
        row.target_field,
        row.required ?? false,
        row.include ?? true,
      );
    });
    if (rows.length) {
      await db.query(
        `INSERT INTO import_field_mappings (job_id, source_field, target_field, required, include)
         VALUES ${insertValues.join(",")}`,
        [jobId, ...params],
      );
    }
  }

  async upsertValueMappings(jobId: string, rows: ValueMappingRow[]) {
    await db.query("DELETE FROM import_value_mappings WHERE job_id = $1", [
      jobId,
    ]);
    if (!rows.length) return;
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4})`,
      );
      params.push(row.source_value, row.target_worktype, row.include ?? true);
    });
    await db.query(
      `INSERT INTO import_value_mappings (job_id, source_value, target_worktype, include)
       VALUES ${insertValues.join(",")}`,
      [jobId, ...params],
    );
  }

  async upsertUserMappings(jobId: string, rows: UserMappingRow[]) {
    await db.query("DELETE FROM import_user_mappings WHERE job_id = $1", [
      jobId,
    ]);
    if (!rows.length) return;
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${
          idx * 5 + 5
        }, $${idx * 5 + 6})`,
      );
      params.push(
        row.source_user_id || null,
        row.source_email || null,
        row.target_user_id || null,
        row.resolution || "unresolved",
        row.include ?? true,
      );
    });
    await db.query(
      `INSERT INTO import_user_mappings (job_id, source_user_id, source_email, target_user_id, resolution, include)
       VALUES ${insertValues.join(",")}`,
      [jobId, ...params],
    );
  }

  async upsertAttachmentPlans(jobId: string, rows: AttachmentPlanRow[]) {
    await db.query("DELETE FROM import_attachment_plans WHERE job_id = $1", [
      jobId,
    ]);
    if (!rows.length) return;
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${
          idx * 6 + 5
        }, $${idx * 6 + 6}, $${idx * 6 + 7})`,
      );
      params.push(
        row.source_url,
        row.filename || null,
        row.content_type || null,
        row.size_bytes ?? null,
        row.status || "planned",
        row.storage_key || null,
      );
    });
    await db.query(
      `INSERT INTO import_attachment_plans (job_id, source_url, filename, content_type, size_bytes, status, storage_key)
       VALUES ${insertValues.join(",")}`,
      [jobId, ...params],
    );
  }

  async upsertStageTasks(jobId: string, rows: StageTaskRow[]) {
    await db.query("DELETE FROM import_stage_tasks WHERE job_id = $1", [jobId]);
    if (!rows.length) return;
    const BATCH_SIZE = 500;
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE);
      const insertValues: string[] = [];
      const params: unknown[] = [];
      batch.forEach((row, idx) => {
        insertValues.push(
          `($1, $${idx * 11 + 2}, $${idx * 11 + 3}, $${idx * 11 + 4}, $${
            idx * 11 + 5
          }, $${idx * 11 + 6}, $${idx * 11 + 7}, $${idx * 11 + 8}, $${
            idx * 11 + 9
          }, $${idx * 11 + 10}, $${idx * 11 + 11}, $${idx * 11 + 12})`,
        );
        params.push(
          row.source_task_id || null,
          row.parent_source_task_id || null,
          row.title,
          row.description || null,
          row.status || null,
          row.due_at || null,
          row.start_at || null,
          row.worktype || null,
          row.assignee_source_id || null,
          row.attachments_planned ?? false,
          row.raw || null,
        );
      });
      await db.query(
        `INSERT INTO import_stage_tasks (job_id, source_task_id, parent_source_task_id, title, description, status, due_at, start_at, worktype, assignee_source_id, attachments_planned, raw)
         VALUES ${insertValues.join(",")}`,
        [jobId, ...params],
      );
    }
  }

  async deleteTargetProject(projectId: string): Promise<void> {
    await db.query("DELETE FROM projects WHERE id = $1", [projectId]);
  }

  async listStageTasks(jobId: string) {
    const { rows } = await db.query(
      "SELECT * FROM import_stage_tasks WHERE job_id = $1 ORDER BY id",
      [jobId],
    );
    return rows;
  }

  async listLogs(jobId: string) {
    const { rows } = await db.query(
      "SELECT * FROM import_logs WHERE job_id = $1 ORDER BY id DESC LIMIT 200",
      [jobId],
    );
    return rows;
  }

  async progress(jobId: string) {
    const job = await this.getJob(jobId);
    if (!job) return null;
    const [
      [hierarchyCount],
      [fieldCount],
      [valueCount],
      [userCount],
      [stageCount],
      [attachmentCount],
    ] = await Promise.all([
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_hierarchy_mappings WHERE job_id = $1",
          [jobId],
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_field_mappings WHERE job_id = $1",
          [jobId],
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_value_mappings WHERE job_id = $1",
          [jobId],
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_user_mappings WHERE job_id = $1",
          [jobId],
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_stage_tasks WHERE job_id = $1",
          [jobId],
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_attachment_plans WHERE job_id = $1",
          [jobId],
        )
        .then((r) => r.rows),
    ]);
    const { rows: recentLogs } = await db.query(
      "SELECT level, message, created_at FROM import_logs WHERE job_id = $1 ORDER BY id DESC LIMIT 20",
      [jobId],
    );
    return {
      job,
      counts: {
        hierarchy: hierarchyCount?.count || 0,
        fields: fieldCount?.count || 0,
        values: valueCount?.count || 0,
        users: userCount?.count || 0,
        stageTasks: stageCount?.count || 0,
        attachments: attachmentCount?.count || 0,
      },
      recentLogs,
    };
  }

  async commit(jobId: string) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await this.updateJobStatus(jobId, "running");

      const job = await this.getJob(jobId);
      if (!job?.target_project_id)
        throw new Error("Target project is required for commit");
      const sourceReference = (job.source_reference as any) || {};
      const importOptions = (sourceReference.options as any) || {};
      const shouldImportMembers = importOptions.importMembers !== false;
      const shouldImportAttachments = importOptions.importAttachments !== false;
      const jiraAuth = (sourceReference?.auth?.jira as any) || {};
      let jiraToken: string | null = jiraAuth?.api_token || null;
      if (!jiraToken && jiraAuth?.api_token_encrypted) {
        try {
          jiraToken = EncryptionService.decrypt(jiraAuth.api_token_encrypted);
        } catch (err) {
          jiraToken = null;
        }
      }
      const jiraEmail =
        typeof jiraAuth?.email === "string" ? jiraAuth.email.trim() : "";
      const jiraAuthHeader =
        jiraToken && jiraEmail
          ? `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString("base64")}`
          : null;
      const importStats = {
        comments: 0,
        worklogs: 0,
        attachments: 0,
        attachmentFailures: 0,
      };

      const [
        { rows: staged },
        { rows: statusRows },
        { rows: priorityRows },
        { rows: userRows },
        { rows: fieldRows },
        { rows: customColumnRows },
        { rows: taskListColumns },
        { rows: valueMappingRows },
      ] = await Promise.all([
        client.query(
          "SELECT * FROM import_stage_tasks WHERE job_id = $1 ORDER BY id",
          [jobId],
        ),
        client.query(
          `SELECT ts.id,
                  ts.name,
                  COALESCE(cat.is_done, FALSE) AS is_done,
                  COALESCE(cat.is_todo, FALSE) AS is_todo
             FROM task_statuses ts
             LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
             WHERE ts.project_id = $1
             ORDER BY ts.sort_order`,
          [job.target_project_id],
        ),
        client.query(
          "SELECT id, name, value FROM task_priorities ORDER BY value NULLS LAST",
        ),
        client.query(
          "SELECT source_user_id, source_email, target_user_id FROM import_user_mappings WHERE job_id = $1 AND (include IS NULL OR include = true)",
          [jobId],
        ),
        client.query(
          "SELECT source_field, target_field, include FROM import_field_mappings WHERE job_id = $1",
          [jobId],
        ),
        client.query(
          "SELECT id, key, field_type FROM cc_custom_columns WHERE project_id = $1",
          [job.target_project_id],
        ),
        client.query(
          "SELECT id, key, pinned FROM project_task_list_cols WHERE project_id = $1",
          [job.target_project_id],
        ),
        client.query(
          "SELECT source_value, target_worktype FROM import_value_mappings WHERE job_id = $1 AND (include IS NULL OR include = true)",
          [jobId],
        ),
      ]);

      const { rows: projectRows } = await client.query(
        "SELECT team_id FROM projects WHERE id = $1",
        [job.target_project_id],
      );
      const targetTeamId = projectRows[0]?.team_id || null;

      const teamMemberEmailMap = new Map<string, string>();
      const teamMemberUserMap = new Map<string, string>();
      const teamMemberUserIdByEmailMap = new Map<string, string>();
      const teamMemberNameMap = new Map<string, string>();
      const loadTeamMemberEmails = async () => {
        if (!targetTeamId) return [] as any[];
        const { rows } = await client.query(
          `SELECT tm.id,
              tm.user_id,
              LOWER(COALESCE(u.email, ei.email)) AS email,
              COALESCE(
                u.name,
                ei.name,
                SPLIT_PART(COALESCE(u.email, ei.email, ''), '@', 1)
              ) AS name
               FROM team_members tm
               LEFT JOIN users u ON u.id = tm.user_id
               LEFT JOIN email_invitations ei ON ei.team_member_id = tm.id
               WHERE tm.team_id = $1`,
          [targetTeamId],
        );
        return rows as any[];
      };
      const hydrateTeamMemberEmails = (rows: any[]) => {
        rows.forEach((row) => {
          if (row?.email) {
            teamMemberEmailMap.set(row.email, row.id);
            if (row?.user_id) {
              teamMemberUserIdByEmailMap.set(row.email, row.user_id);
            }
          }
          if (row?.user_id) {
            teamMemberUserMap.set(row.user_id, row.id);
          }
          if (row?.name) {
            const normalizedName = row.name.toString().trim().toLowerCase();
            if (normalizedName) teamMemberNameMap.set(normalizedName, row.id);
          }
        });
      };
      if (targetTeamId) {
        const initialMembers = await loadTeamMemberEmails();
        hydrateTeamMemberEmails(initialMembers);
      }
      let creatorTeamMemberId: string | null = null;
      if (targetTeamId) {
        const { rows: creatorRows } = await client.query(
          "SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1",
          [targetTeamId, job.created_by]
        );
        creatorTeamMemberId = creatorRows[0]?.id || null;
      }

      const ensureSourceTeamMembers = async () => {
        if (!targetTeamId) return;
        const pendingEmails = new Set<string>();
        staged.forEach((task: StageTaskRow) => {
          const candidate =
            typeof task.assignee_source_id === "string"
              ? task.assignee_source_id.trim()
              : "";
          if (candidate && candidate.includes("@")) {
            const normalized = candidate.toLowerCase();
            if (!teamMemberEmailMap.has(normalized)) {
              pendingEmails.add(normalized);
            }
          }
          const comments = parseImportedArray<ImportedJiraComment>(
            task.raw,
            "__jira_comments"
          );
          comments.forEach((comment) => {
            const email = (comment?.authorEmail || "").trim().toLowerCase();
            if (!email || !email.includes("@")) return;
            if (!teamMemberEmailMap.has(email)) {
              pendingEmails.add(email);
            }
          });
        });
        if (!pendingEmails.size) return;
        await client.query("SELECT create_team_member($1) AS new_members;", [
          JSON.stringify({
            team_id: targetTeamId,
            emails: Array.from(pendingEmails),
          }),
        ]);
        teamMemberEmailMap.clear();
        teamMemberUserMap.clear();
        teamMemberUserIdByEmailMap.clear();
        teamMemberNameMap.clear();
        const refreshedMembers = await loadTeamMemberEmails();
        hydrateTeamMemberEmails(refreshedMembers);
      };

      if (shouldImportMembers) {
        await ensureSourceTeamMembers();
      }

      const labelNameMap = new Map<string, string>();

      const loadTeamLabels = async () => {
        if (!targetTeamId) return;
        const { rows } = await client.query(
          "SELECT id, name FROM team_labels WHERE team_id = $1",
          [targetTeamId],
        );
        rows.forEach((row: any) => {
          if (row?.name && row?.id) {
            labelNameMap.set(row.name.toString().trim().toLowerCase(), row.id);
          }
        });
      };

      await loadTeamLabels();

      const { rows: replaceTaskLabelsRows } = await client.query(
        "SELECT to_regproc('replace_task_labels') AS fn;",
      );
      const hasReplaceTaskLabels = !!replaceTaskLabelsRows?.[0]?.fn;

      let labelColorIndex = labelNameMap.size;
      const nextLabelColor = () =>
        SELECTION_COLORS[labelColorIndex++ % SELECTION_COLORS.length];

      const ensureLabelId = async (name: string): Promise<string | null> => {
        if (!targetTeamId) return null;
        const normalized = normalizeLabelName(name);
        if (!normalized) return null;
        const key = normalized.toLowerCase();
        const existing = labelNameMap.get(key);
        if (existing) return existing;

        const { rows } = await client.query(
          `INSERT INTO team_labels (name, color_code, team_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING
             RETURNING id;`,
          [normalized, nextLabelColor(), targetTeamId],
        );

        const createdId = rows?.[0]?.id;
        if (createdId) {
          labelNameMap.set(key, createdId);
          return createdId;
        }

        const { rows: fallbackRows } = await client.query(
          "SELECT id FROM team_labels WHERE team_id = $1 AND name = $2",
          [targetTeamId, normalized],
        );
        const fallbackId = fallbackRows?.[0]?.id || null;
        if (fallbackId) labelNameMap.set(key, fallbackId);
        return fallbackId;
      };

      const resolveLabelIds = async (labels?: string[] | null) => {
        if (!labels?.length) return [] as string[];
        const ids: string[] = [];
        for (const label of labels) {
          const id = await ensureLabelId(label);
          if (id) ids.push(id);
        }
        return Array.from(new Set(ids));
      };

      // Map source status values (from import_value_mappings) to target status names
      const sourcesToTargetStatus = new Map<string, string>();
      (valueMappingRows || []).forEach((row: any) => {
        if (row.source_value && row.target_worktype) {
          sourcesToTargetStatus.set(
            row.source_value.toString().trim().toLowerCase(),
            row.target_worktype.toString().trim().toLowerCase(),
          );
        }
      });

      const statusMap = new Map<string, string>();
      const doneStatusIds = new Set<string>();
      let defaultDoneStatusId: string | null = null;
      statusRows.forEach((row: any) => {
        if (row.name) {
          statusMap.set(row.name.toString().toLowerCase(), row.id);
        }
        if (row.is_done) {
          doneStatusIds.add(row.id);
          if (!defaultDoneStatusId) defaultDoneStatusId = row.id;
        }
      });
      const defaultStatusId =
        statusRows.find((row: any) => row.is_todo)?.id ||
        statusRows[0]?.id ||
        null;

      if (!defaultStatusId) {
        throw new Error("Target project has no statuses configured");
      }

      const defaultPriorityId = priorityRows[0]?.id || null;

      const priorityMap = new Map<string, string>();
      priorityRows.forEach((row: any) => {
        if (row.name)
          priorityMap.set(row.name.toString().toLowerCase(), row.id);
      });

      const assigneeMap = new Map<string, string>();
      userRows.forEach((row: any) => {
        if (row.source_user_id && row.target_user_id)
          assigneeMap.set(row.source_user_id.toString(), row.target_user_id);
        if (row.source_user_id && row.target_user_id)
          assigneeMap.set(
            row.source_user_id.toString().toLowerCase(),
            row.target_user_id,
          );
        if (row.source_email && row.target_user_id)
          assigneeMap.set(
            row.source_email.toString().toLowerCase(),
            row.target_user_id,
          );
      });

      const activeFieldMappings: FieldMappingRow[] = (fieldRows ||
        []) as FieldMappingRow[];

      const customColumnMap = new Map<string, CustomColumnRef>();
      customColumnRows.forEach((row: any) => {
        if (row.key)
          customColumnMap.set(row.key, {
            id: row.id,
            key: row.key,
            fieldType: row.field_type || undefined,
          });
      });

      const customColumnPlans = new Map<string, CustomColumnPlan>();
      activeFieldMappings.forEach((mapping) => {
        if (mapping.include === false) return;
        const normalizedTarget = normalizeTargetField(mapping.target_field);
        if (STANDARD_TARGET_FIELDS.has(normalizedTarget)) return;

        // Skip standard custom field mappings when Monday-specific versions exist
        const hasMondaySpecificMapping = activeFieldMappings.some(
          (m) =>
            m.target_field?.startsWith("monday_") &&
            m.target_field.includes(normalizedTarget),
        );

        if (hasMondaySpecificMapping) {
          return;
        }

        const key = toColumnKey(normalizedTarget);
        if (!customColumnPlans.has(key)) {
          const sourceField = mapping.source_field || normalizedTarget;
          customColumnPlans.set(key, {
            key,
            name: sourceField,
            sourceField,
            samples: new Set<string>(),
          });
        }
      });

      if (customColumnPlans.size) {
        staged.forEach((task: StageTaskRow) => {
          const rawSource =
            task.raw && typeof task.raw === "object" && !Array.isArray(task.raw)
              ? (task.raw as Record<string, unknown>)
              : {};
          customColumnPlans.forEach((plan) => {
            const rawValue = getNormalizedFieldValue(rawSource, [
              plan.sourceField,
            ]);
            const sanitized = sanitizeSampleValue(rawValue);
            if (sanitized) {
              plan.samples.add(sanitized);
            }
          });
        });
      }

      const customColumnConfigs = new Map<string, ColumnPlanConfig>();
      customColumnPlans.forEach((plan, key) => {
        customColumnConfigs.set(key, inferColumnConfig(plan));
      });

      const TASK_LIST_COLUMN_INFO: Record<
        string,
        { key: string; name: string; index: number }
      > = {
        key: { key: "KEY", name: "Key", index: 0 },
        description: { key: "DESCRIPTION", name: "Description", index: 2 },
        progress: { key: "PROGRESS", name: "Progress", index: 3 },
        status: { key: "STATUS", name: "Status", index: 4 },
        assignees: { key: "ASSIGNEES", name: "Members", index: 5 },
        labels: { key: "LABELS", name: "Labels", index: 6 },
        phase: { key: "PHASE", name: "Phase", index: 7 },
        priority: { key: "PRIORITY", name: "Priority", index: 8 },
        timeTracking: { key: "TIME_TRACKING", name: "Time Tracking", index: 9 },
        estimation: { key: "ESTIMATION", name: "Estimation", index: 10 },
        startDate: { key: "START_DATE", name: "Start Date", index: 11 },
        dueDate: { key: "DUE_DATE", name: "Due Date", index: 12 },
        completedDate: {
          key: "COMPLETED_DATE",
          name: "Completed Date",
          index: 13,
        },
        createdDate: { key: "CREATED_DATE", name: "Created Date", index: 14 },
        lastUpdated: { key: "LAST_UPDATED", name: "Last Updated", index: 15 },
        reporter: { key: "REPORTER", name: "Reporter", index: 16 },
      };

      const taskListColumnMap = new Map<
        string,
        { id: string; pinned: boolean }
      >();
      taskListColumns.forEach((col: any) => {
        if (col?.key)
          taskListColumnMap.set(col.key, { id: col.id, pinned: !!col.pinned });
      });

      const ensureTaskListColumn = async (info: {
        key: string;
        name: string;
        index: number;
      }) => {
        const existing = taskListColumnMap.get(info.key);
        if (existing) {
          if (!existing.pinned) {
            await client.query(
              "UPDATE project_task_list_cols SET pinned = TRUE WHERE id = $1",
              [existing.id],
            );
            taskListColumnMap.set(info.key, { id: existing.id, pinned: true });
          }
          return;
        }

        const inserted = await client.query(
          `INSERT INTO project_task_list_cols (project_id, name, key, index, pinned, custom_column, custom_column_obj)
           VALUES ($1, $2, $3, $4, TRUE, FALSE, NULL)
           RETURNING id`,
          [job.target_project_id, info.name, info.key, info.index],
        );
        const newId = inserted.rows[0]?.id;
        if (newId) taskListColumnMap.set(info.key, { id: newId, pinned: true });
      };

      for (const mapping of activeFieldMappings) {
        if (mapping.include === false) continue;
        const normalizedTarget = normalizeTargetField(mapping.target_field);
        const info = TASK_LIST_COLUMN_INFO[normalizedTarget];
        if (info) {
          await ensureTaskListColumn(info);
        }
      }

      const configureColumnMetadata = async (
        columnId: string,
        plan: CustomColumnPlan,
        config: ColumnPlanConfig,
      ) => {
        await client.query(
          "DELETE FROM cc_column_configurations WHERE column_id = $1",
          [columnId],
        );
        await client.query(
          `INSERT INTO cc_column_configurations (
             column_id,
             field_title,
             field_type,
             number_type,
             decimals,
             label,
             label_position,
             preview_value,
             expression,
             first_numeric_column_key,
             second_numeric_column_key
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            columnId,
            plan.name,
            config.fieldType,
            config.numberType || null,
            config.decimals ?? null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        );
        await client.query(
          "DELETE FROM cc_selection_options WHERE column_id = $1",
          [columnId],
        );
        await client.query(
          "DELETE FROM cc_label_options WHERE column_id = $1",
          [columnId],
        );
        if (config.fieldType === "selection" && config.selections?.length) {
          for (const [order, selection] of config.selections.entries()) {
            await client.query(
              `INSERT INTO cc_selection_options (
                 column_id,
                 selection_id,
                 selection_name,
                 selection_color,
                 selection_order
               ) VALUES ($1,$2,$3,$4,$5)`,
              [columnId, selection.id, selection.name, selection.color, order],
            );
          }
        }
      };

      const ensureCustomColumn = async (
        plan: CustomColumnPlan,
        config: ColumnPlanConfig,
      ): Promise<CustomColumnRef | null> => {
        const existing = customColumnMap.get(plan.key);
        if (existing) {
          await client.query(
            `UPDATE cc_custom_columns
             SET name = $1,
                 field_type = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [plan.name, config.fieldType, existing.id],
          );
          await configureColumnMetadata(existing.id, plan, config);
          const column = {
            id: existing.id,
            key: plan.key,
            fieldType: config.fieldType,
          };
          customColumnMap.set(plan.key, column);
          return column;
        }

        const columnResult = await client.query(
          `INSERT INTO cc_custom_columns (
             project_id,
             name,
             key,
             field_type,
             width,
             is_visible,
             is_custom_column
           ) VALUES ($1,$2,$3,$4,$5,$6,true)
           ON CONFLICT (project_id, key) DO UPDATE SET
             name = EXCLUDED.name,
             field_type = EXCLUDED.field_type,
             updated_at = NOW()
           RETURNING id;`,
          [
            job.target_project_id,
            plan.name,
            plan.key,
            config.fieldType,
            150,
            true,
          ],
        );
        const columnId = columnResult.rows[0]?.id;
        if (!columnId) return null;

        await configureColumnMetadata(columnId, plan, config);
        const column = {
          id: columnId,
          key: plan.key,
          fieldType: config.fieldType,
        };
        customColumnMap.set(plan.key, column);
        return column;
      };

      const insertCustomColumnValue = async (
        taskId: string,
        column: CustomColumnRef,
        customValue: CustomFieldValuePlan,
        config?: ColumnPlanConfig,
      ) => {
        if (!column?.id) {
          return;
        }
        const effectiveConfig = config || customColumnConfigs.get(column.key);
        const fieldType = effectiveConfig?.fieldType || column.fieldType;
        const normalizedValue = sanitizeSampleValue(customValue.value);

        let textValue: string | null = null;
        let numberValue: number | null = null;
        let dateValue: Date | null = null;
        let booleanValue: boolean | null = null;
        let jsonValue: string | null = null;

        // Ensure selection options stay in sync with incoming values. If a value arrives
        // that wasn't part of the initial sample set (or was trimmed differently), we
        // create the option on the fly so the stored selection_id always matches an
        // existing dropdown option.
        const ensureSelectionOption = async (
          value: string,
        ): Promise<string> => {
          if (!effectiveConfig) return value;

          // Lazily initialise selections/valueToSelectionId if missing
          if (!effectiveConfig.selections) effectiveConfig.selections = [];
          if (!effectiveConfig.valueToSelectionId)
            effectiveConfig.valueToSelectionId = new Map<string, string>();

          const existingId = effectiveConfig.valueToSelectionId.get(value);
          if (existingId) return existingId;

          const slug =
            slugify(value, { lower: true, strict: true }).slice(0, 40) ||
            `option-${effectiveConfig.selections.length}`;
          const generatedId = `${column.key}-${slug}-${effectiveConfig.selections.length}`;

          effectiveConfig.selections.push({
            id: generatedId,
            name: value,
            color:
              SELECTION_COLORS[
                effectiveConfig.selections.length % SELECTION_COLORS.length
              ],
          });
          effectiveConfig.valueToSelectionId.set(value, generatedId);

          // Persist the newly discovered option so dropdowns render it immediately
          await client.query(
            `INSERT INTO cc_selection_options (
               column_id, selection_id, selection_name, selection_color, selection_order
             ) VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT DO NOTHING;`,
            [
              column.id,
              generatedId,
              value,
              SELECTION_COLORS[
                effectiveConfig.selections.length % SELECTION_COLORS.length
              ],
              effectiveConfig.selections.length - 1,
            ],
          );

          return generatedId;
        };

        switch (fieldType) {
          case "number": {
            if (!normalizedValue) break;
            const numericValue = Number(normalizedValue);
            if (!Number.isFinite(numericValue)) break;
            numberValue = numericValue;
            break;
          }
          case "date": {
            if (!normalizedValue) break;
            const parsed = new Date(normalizedValue);
            if (Number.isNaN(parsed.getTime())) break;
            dateValue = parsed;
            break;
          }
          case "checkbox": {
            if (!normalizedValue) break;
            const coerced = coerceBooleanValue(normalizedValue);
            if (coerced === null) break;
            booleanValue = coerced;
            break;
          }
          case "selection": {
            if (!normalizedValue) break;
            const selectionId = effectiveConfig?.valueToSelectionId?.get(
              normalizedValue,
            )
              ? effectiveConfig.valueToSelectionId!.get(normalizedValue)!
              : await ensureSelectionOption(normalizedValue);
            textValue = selectionId;
            break;
          }
          case "people": {
            if (!normalizedValue) break;
            jsonValue = JSON.stringify([normalizedValue]);
            break;
          }
          case "text": {
            if (!normalizedValue) break;
            textValue = normalizedValue;
            break;
          }
          default: {
            if (!normalizedValue) break;
            textValue = normalizedValue;
          }
        }

        if (
          textValue === null &&
          numberValue === null &&
          dateValue === null &&
          booleanValue === null &&
          jsonValue === null
        ) {
          return;
        }

        await client.query(
          `INSERT INTO cc_column_values (
             task_id,
             column_id,
             text_value,
             number_value,
             date_value,
             boolean_value,
             json_value,
             created_at,
             updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
           ON CONFLICT (task_id, column_id)
           DO UPDATE SET
             text_value = EXCLUDED.text_value,
             number_value = EXCLUDED.number_value,
             date_value = EXCLUDED.date_value,
             boolean_value = EXCLUDED.boolean_value,
             json_value = EXCLUDED.json_value,
             updated_at = NOW();`,
          [
            taskId,
            column.id,
            textValue,
            numberValue,
            dateValue,
            booleanValue,
            jsonValue,
          ],
        );
      };

      for (const plan of customColumnPlans.values()) {
        const config =
          customColumnConfigs.get(plan.key) || inferColumnConfig(plan);
        customColumnConfigs.set(plan.key, config);
        await ensureCustomColumn(plan, config);
      }

      const createdTasks: any[] = [];
      const sourceToId = new Map<string, string>();
      const roots = staged.filter((task: any) => !task.parent_source_task_id);
      const deferred = staged.filter((task: any) => task.parent_source_task_id);

      const lookupStatusId = (value?: string | null): string | null => {
        if (!value) return defaultStatusId;
        const key = value.toString().trim().toLowerCase();
        // Apply value mapping (e.g. "Doing" → "In Progress") before status lookup
        const mappedKey = sourcesToTargetStatus.get(key) || key;
        const match = statusMap.get(mappedKey) || null;
        return match || defaultStatusId;
      };

      const parseDateValue = (value?: string | null): Date | null => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const getRawCompletedValue = (raw: unknown): string | null => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
        const source = raw as Record<string, unknown>;
        const normalizedEntries = Object.entries(source).map(
          ([key, value]) => ({
            key: key.trim().toLowerCase(),
            value,
          }),
        );
        const candidates = new Set([
          "completed on",
          "completed_on",
          "completed date",
          "completeddate",
          "completed",
        ]);
        for (const entry of normalizedEntries) {
          if (!candidates.has(entry.key)) continue;
          if (typeof entry.value === "string" && entry.value.trim()) {
            return entry.value;
          }
        }
        return null;
      };

      const finalizeTaskCompletion = async (
        taskId: string,
        statusId: string | null,
        completedDate: Date | null,
      ) => {
        const shouldMarkDone =
          (statusId && doneStatusIds.has(statusId)) || !!completedDate;
        if (!shouldMarkDone) return;
        await client.query(
          `UPDATE tasks
             SET done = TRUE,
                 completed_at = COALESCE($2::timestamptz, completed_at, NOW())
           WHERE id = $1`,
          [taskId, completedDate || null],
        );
      };

      const PRIORITY_ALIASES: Record<string, string> = {
        highest: "urgent",
        critical: "urgent",
        blocker: "urgent",
        lowest: "low",
        minor: "low",
        trivial: "low",
        normal: "medium",
        moderate: "medium",
      };

      const resolvePriorityId = (value?: string | null) => {
        if (!value) return defaultPriorityId;
        const key = value.toString().trim().toLowerCase();
        return (
          priorityMap.get(key) ||
          priorityMap.get(PRIORITY_ALIASES[key] || key) ||
          defaultPriorityId
        );
      };

      const normalizeAssigneeToken = (token: string) =>
        token.trim().toLowerCase().replace(/\s+/g, " ");

      const resolveAssignees = (value?: string | null) => {
        if (!shouldImportMembers) return [] as string[];
        if (!value) return [] as string[];
        const normalized = value.toString().trim();
        if (!normalized) return [] as string[];
        const lower = normalized.toLowerCase();
        const nameKey = normalizeAssigneeToken(normalized);
        const direct = assigneeMap.get(normalized);
        const emailMatch = assigneeMap.get(lower);
        const teamMemberId =
          direct ||
          emailMatch ||
          teamMemberEmailMap.get(lower) ||
          teamMemberNameMap.get(nameKey);
        return teamMemberId ? [teamMemberId] : [];
      };

      const importTaskComments = async (taskId: string, raw: unknown) => {
        if (!creatorTeamMemberId) return;
        const comments = parseImportedArray<ImportedJiraComment>(
          raw,
          "__jira_comments"
        );
        for (const comment of comments) {
          const body = (comment?.body || "").trim();
          if (!body) continue;
          const author = (comment?.author || "Unknown").trim();
          const createdSuffix = comment?.created ? ` (${comment.created})` : "";
          const content = clampText(
            `${author}${createdSuffix}: ${body}`.trim(),
            5000
          );
          if (!content) continue;
          const createdAt = safeDate(comment?.created || null);
          const sourceAccountId = (comment?.authorAccountId || "").trim();
          const sourceEmail = (comment?.authorEmail || "").trim().toLowerCase();
          const mappedUserId =
            (sourceAccountId ? assigneeMap.get(sourceAccountId) : null) ||
            (sourceAccountId ? assigneeMap.get(sourceAccountId.toLowerCase()) : null) ||
            (sourceEmail ? assigneeMap.get(sourceEmail) : null) ||
            null;
          const mappedTeamMemberId = mappedUserId
            ? teamMemberUserMap.get(mappedUserId) || null
            : null;
          const emailTeamMemberId = sourceEmail
            ? teamMemberEmailMap.get(sourceEmail) || null
            : null;

          let commentUserId = job.created_by;
          let commentTeamMemberId = creatorTeamMemberId;

          if (mappedUserId && mappedTeamMemberId) {
            commentUserId = mappedUserId;
            commentTeamMemberId = mappedTeamMemberId;
          } else if (sourceEmail && emailTeamMemberId) {
            const resolvedUserId =
              teamMemberUserIdByEmailMap.get(sourceEmail) || null;
            if (resolvedUserId) {
              commentUserId = resolvedUserId;
              commentTeamMemberId = emailTeamMemberId;
            }
          }

          const result = await client.query(
            `INSERT INTO task_comments (user_id, team_member_id, task_id, created_at, updated_at)
             VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), COALESCE($4::timestamptz, NOW()))
             RETURNING id`,
            [commentUserId, commentTeamMemberId, taskId, createdAt]
          );
          const commentId = result.rows?.[0]?.id || null;
          if (!commentId) continue;
          await client.query(
            "INSERT INTO task_comment_contents (index, comment_id, text_content) VALUES ($1, $2, $3)",
            [0, commentId, content]
          );
          importStats.comments += 1;
        }
      };

      const importTaskWorklogs = async (taskId: string, raw: unknown) => {
        const worklogs = parseImportedArray<ImportedJiraWorklog>(
          raw,
          "__jira_worklogs"
        );
        for (const worklog of worklogs) {
          const seconds = Math.max(0, Number(worklog?.timeSpentSeconds || 0));
          if (!seconds) continue;
          const author = (worklog?.author || "Unknown").trim();
          const startedSuffix = worklog?.started ? ` (${worklog.started})` : "";
          const note = (worklog?.comment || "").trim();
          const description = clampText(
            `Imported from Jira by ${author}${startedSuffix}${note ? ` - ${note}` : ""}`.trim(),
            500
          );
          const loggedAt = safeDate(worklog?.started || worklog?.created || null);
          await client.query(
            `INSERT INTO task_work_log (time_spent, description, task_id, user_id, created_at, updated_at, logged_by_timer)
             VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), COALESCE($5::timestamptz, NOW()), FALSE)`,
            [seconds, description || null, taskId, job.created_by, loggedAt]
          );
          importStats.worklogs += 1;
        }
      };

      const importTaskAttachments = async (taskId: string, raw: unknown) => {
        if (!shouldImportAttachments || !targetTeamId) return;
        const attachments = parseImportedArray<ImportedJiraAttachment>(
          raw,
          "__jira_attachments"
        );
        for (const attachment of attachments) {
          const sourceUrl = (attachment?.url || "").trim();
          if (!sourceUrl) continue;
          const fileName = clampText(
            (attachment?.filename || "jira-attachment").trim() || "jira-attachment",
            110
          );
          const extension = normalizeFileExtension(
            fileName,
            attachment?.mimeType || null,
            sourceUrl
          );
          const contentType =
            attachment?.mimeType || "application/octet-stream";
          try {
            const response = await axios.get<ArrayBuffer>(sourceUrl, {
              responseType: "arraybuffer",
              timeout: 30000,
              headers: jiraAuthHeader
                ? { Authorization: jiraAuthHeader, Accept: "*/*" }
                : { Accept: "*/*" },
            });
            const buffer = Buffer.from(response.data);
            const sizeBytes =
              attachment?.size && attachment.size > 0
                ? attachment.size
                : buffer.length;
            const insert = await client.query(
              `INSERT INTO task_attachments (name, task_id, team_id, project_id, uploaded_by, size, type)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                fileName,
                taskId,
                targetTeamId,
                job.target_project_id,
                job.created_by,
                sizeBytes,
                extension,
              ]
            );
            const attachmentId = insert.rows?.[0]?.id || null;
            if (!attachmentId) {
              importStats.attachmentFailures += 1;
              continue;
            }
            const storageKey = getKey(
              targetTeamId,
              job.target_project_id as string,
              attachmentId,
              extension
            );
            const uploaded = await uploadBuffer(buffer, contentType, storageKey);
            if (!uploaded) {
              await client.query("DELETE FROM task_attachments WHERE id = $1", [
                attachmentId,
              ]);
              importStats.attachmentFailures += 1;
              continue;
            }
            importStats.attachments += 1;
          } catch (err) {
            importStats.attachmentFailures += 1;
          }
        }
      };

      const createTask = async (task: any, parentId?: string | null) => {
        const { patch, customValues } = mapRawToTaskFields(
          task.raw,
          activeFieldMappings,
        );
        const taskWithMappings = { ...task, ...patch } as any;
        // tasks.name has a CHECK constraint (CHAR_LENGTH(name) <= 500). Clamp
        // the title and fall back to a placeholder so a single over-long or
        // empty row can't abort the whole import transaction.
        const rawTitle = String(
          (taskWithMappings as any).title || task.title || "",
        ).trim();
        const taskTitle = (rawTitle || "Untitled task").slice(0, 500);
        let statusId = lookupStatusId(taskWithMappings.status);
        const completedValue =
          typeof taskWithMappings.completed_at === "string" &&
          taskWithMappings.completed_at.trim()
            ? taskWithMappings.completed_at
            : getRawCompletedValue(task.raw);
        const completedDate = parseDateValue(completedValue);
        if (
          completedDate &&
          defaultDoneStatusId &&
          (!statusId || !doneStatusIds.has(statusId))
        ) {
          statusId = defaultDoneStatusId;
        }

        const labelIds = await resolveLabelIds(taskWithMappings.labels);

        const payload: Record<string, unknown> = {
          name: taskTitle,
          project_id: job.target_project_id,
          team_id: targetTeamId,
          description: taskWithMappings.description,
          start: taskWithMappings.start_at,
          end: taskWithMappings.due_at,
          total_minutes: 0,
          reporter_id: job.created_by,
          status_id: statusId,
          priority_id: resolvePriorityId(taskWithMappings.priority_label),
          parent_task_id: parentId || null,
          assignees: resolveAssignees(taskWithMappings.assignee_source_id),
        };

        const result = await client.query("SELECT create_task($1) AS task;", [
          JSON.stringify(payload),
        ]);
        const createdRow = result.rows?.[0] || null;
        const createdTask =
          (createdRow as any)?.task ||
          (createdRow as any)?.create_task ||
          createdRow ||
          null;
        // Some drivers return { task: { task: {...}, priorities: [...] } }
        // Normalize to the inner task object so we can read the id.
        const created =
          (createdTask as any)?.task?.task ||
          (createdTask as any)?.task ||
          createdTask ||
          null;
        if (
          created?.id &&
          (taskWithMappings.created_at || taskWithMappings.updated_at)
        ) {
          const createdAt = taskWithMappings.created_at
            ? new Date(taskWithMappings.created_at)
            : null;
          const updatedAt = taskWithMappings.updated_at
            ? new Date(taskWithMappings.updated_at)
            : null;
          await client.query(
            `UPDATE tasks
               SET created_at = COALESCE($2::timestamptz, created_at),
                   updated_at = COALESCE($3::timestamptz, updated_at)
             WHERE id = $1
             RETURNING created_at, updated_at`,
            [
              created.id,
              createdAt && !isNaN(createdAt.valueOf()) ? createdAt : null,
              updatedAt && !isNaN(updatedAt.valueOf()) ? updatedAt : null,
            ],
          );
        }
        if (created?.id && task.source_task_id) {
          sourceToId.set(task.source_task_id, created.id);
        }
        if (created?.id) {
          await finalizeTaskCompletion(created.id, statusId, completedDate);
          if (completedDate && created) {
            created.completed_at = completedDate.toISOString();
          }
        }

        if (created?.id && labelIds.length) {
          if (hasReplaceTaskLabels) {
            await client.query(
              "SELECT replace_task_labels($1, $2) AS labels;",
              [created.id, labelIds],
            );
          } else {
            await client.query("DELETE FROM task_labels WHERE task_id = $1", [
              created.id,
            ]);
            await client.query(
              "INSERT INTO task_labels (task_id, label_id) SELECT $1, UNNEST($2::uuid[]) ON CONFLICT DO NOTHING",
              [created.id, labelIds],
            );
          }
        }
        createdTasks.push(created);

        if (created?.id) {
          await importTaskComments(created.id, task.raw);
          await importTaskWorklogs(created.id, task.raw);
          await importTaskAttachments(created.id, task.raw);
        }

        if (created?.id && customValues.length) {
          for (const customValue of customValues) {
            let plan = customColumnPlans.get(customValue.columnKey);
            let config = customColumnConfigs.get(customValue.columnKey);

            if (!plan) {
              plan = {
                key: customValue.columnKey,
                name: customValue.columnName,
                sourceField: customValue.columnName,
                samples: new Set<string>([
                  sanitizeSampleValue(customValue.value),
                ]),
              };
              customColumnPlans.set(customValue.columnKey, plan);
              config = inferColumnConfig(plan);
              customColumnConfigs.set(customValue.columnKey, config);
            }

            if (!config && plan) {
              config = inferColumnConfig(plan);
              customColumnConfigs.set(plan.key, config);
            }

            const column =
              customColumnMap.get(customValue.columnKey) ||
              (plan && config ? await ensureCustomColumn(plan, config) : null);
            if (!column) continue;

            await insertCustomColumnValue(
              created.id,
              column,
              customValue,
              config,
            );
          }
        }
      };

      for (const task of roots) {
        await createTask(task, null);
      }

      let guard = deferred.length * 2;
      while (deferred.length && guard > 0) {
        const task = deferred.shift() as any;
        const parentId = task.parent_source_task_id
          ? sourceToId.get(task.parent_source_task_id) || null
          : null;
        if (task.parent_source_task_id && !parentId) {
          deferred.push(task);
          guard -= 1;
          continue;
        }
        await createTask(task, parentId);
      }

      if (deferred.length) {
        const unresolved = deferred.length;
        await this.appendLog(jobId, "warning", "Unresolved parent tasks", {
          unresolved,
        });
        for (const task of deferred) {
          await createTask(task, null);
        }
      }

      const progress = await this.progress(jobId);
      const stats = progress?.counts || {};
      await this.appendLog(jobId, "info", "Commit pipeline executed", {
        stats,
        created: createdTasks.length,
        imported: importStats,
        options: {
          importMembers: shouldImportMembers,
          importAttachments: shouldImportAttachments,
        },
      });
      await this.updateJobStatus(jobId, "success", undefined, stats);
      await client.query("COMMIT");
    } catch (err: any) {
      await client.query("ROLLBACK");
      const message = err?.message || "Commit failed";
      await this.appendLog(jobId, "error", message, {
        error: err?.stack || err,
      });
      await this.updateJobStatus(jobId, "failed", message);
      throw err;
    } finally {
      client.release();
    }
  }

  async cancel(jobId: string, message?: string) {
    await this.updateJobStatus(jobId, "failed", message || "Cancelled");
  }
}

export default new ImportsService();
