import slugify from "slugify";
import {
  ColumnPlanConfig,
  CustomColumnPlan,
  CustomFieldValuePlan,
  FieldMappingRow,
  SelectionOptionPlan,
  TaskFieldPatch,
} from "./types";
import {
  MAX_SELECTION_OPTIONS,
  SELECTION_COLORS,
  countDecimalPlaces,
  isBooleanSample,
  isDateSample,
  isNumericSample,
  parseLabelValues,
} from "./value-utils";

export const collectAssigneeCandidates = (
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

export const pickBestAssignee = (
  candidates: string[],
  current?: string | null,
): string | null => {
  if (!candidates.length) return current || null;
  const hasEmail = candidates.find((c) => c.includes("@"));
  if (hasEmail) return hasEmail;
  return candidates[0] || current || null;
};

export const buildSelectionOptions = (
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

export const inferColumnConfig = (plan: CustomColumnPlan): ColumnPlanConfig => {
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

export const STANDARD_TARGET_FIELDS = new Set<string>([
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

export const TARGET_FIELD_ALIASES: Record<string, string> = {
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

export const normalizeTargetField = (value: string) => {
  const normalized = slugify(value || "", {
    lower: true,
    strict: true,
  }).replace(/-/g, "");
  return TARGET_FIELD_ALIASES[normalized] || value;
};

export const toColumnKey = (value: string) =>
  slugify(value || "custom-column", { lower: true, strict: true }) ||
  "custom-column";

export const normalizeRawFieldName = (value?: string | null) =>
  slugify(value || "", { lower: true, strict: true }).replace(/-/g, "");

export const getNormalizedFieldValue = (
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
