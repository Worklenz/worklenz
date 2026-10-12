import { TaskExportCustomFieldDef } from "./types";
import { getStandardTaskExportHeaders } from "./columns";

/**
 * Ensures custom-field CSV headers are unique when display names collide.
 * First occurrence keeps the configured name; later ones append ` (key)`.
 */
export const buildUniqueCustomFieldHeaders = (
  customFields: TaskExportCustomFieldDef[]
): string[] => {
  const seen = new Map<string, number>();
  const headers: string[] = [];

  for (const field of customFields) {
    const baseName = (field.name || field.key || "").trim() || field.key;
    const count = seen.get(baseName) ?? 0;
    seen.set(baseName, count + 1);

    if (count === 0) {
      headers.push(baseName);
    } else {
      headers.push(`${baseName} (${field.key})`);
    }
  }

  return headers;
};

/**
 * TE-11 / TE-29: standard headers + one column per project custom field (by name).
 * When `customFields` is empty, returns only standard columns — no blank custom headers.
 */
export const buildTaskExportHeaders = (
  customFields: TaskExportCustomFieldDef[] = []
): string[] => {
  return [
    ...getStandardTaskExportHeaders(),
    ...buildUniqueCustomFieldHeaders(customFields),
  ];
};
