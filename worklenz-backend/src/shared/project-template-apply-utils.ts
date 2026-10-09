/**
 * Pure helpers for custom project template apply (Phase 8).
 * Kept free of DB/IO so unit tests can cover merge, offsets, and back-compat.
 */

export interface IMergedProjectSettingsForImport {
  category_id: string | null;
  project_manager_id: string | null;
  working_days: number;
  man_days: number;
  hours_per_day: number;
  advanced: {
    use_manual_progress: boolean;
    use_weighted_progress: boolean;
    use_time_progress: boolean;
    auto_assign_task_creator: boolean;
    restrict_task_creation: boolean;
    phase_assignees_enabled: boolean;
  };
  budget: { amount: number | null; currency: string | null } | null;
}

const pickNumber = (
  overrideVal: number | null | undefined,
  baseVal: number | null | undefined,
  fallback: number
): number => {
  if (overrideVal !== undefined) {
    if (overrideVal === null) return fallback;
    const n = Number(overrideVal);
    return Number.isFinite(n) ? n : fallback;
  }
  if (baseVal !== undefined && baseVal !== null) {
    const n = Number(baseVal);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

/**
 * Merge template settings snapshot with review-step overrides.
 * Null/empty template settings (schema_version 1 / old templates) → blank defaults.
 * Overrides win; never mutates the template row.
 */
export const mergeProjectSettingsForImport = (
  templateSettings: Record<string, any> | null | undefined,
  overrides: Record<string, any> | null | undefined
): IMergedProjectSettingsForImport => {
  const base =
    templateSettings && typeof templateSettings === "object" ? templateSettings : {};
  const over = overrides && typeof overrides === "object" ? overrides : {};

  const category_id =
    over.category_id !== undefined ? over.category_id || null : base.category_id || null;

  const project_manager_id =
    over.project_manager_id !== undefined
      ? over.project_manager_id || null
      : base.project_manager_id || null;

  const working_days = pickNumber(
    over.estimated_working_days,
    base.estimated_working_days,
    0
  );
  const man_days = pickNumber(over.estimated_man_days, base.estimated_man_days, 0);
  const hours_per_day = pickNumber(over.hours_per_day, base.hours_per_day, 8);

  const baseAdvanced =
    base.advanced && typeof base.advanced === "object" ? base.advanced : {};
  const overAdvanced =
    over.advanced && typeof over.advanced === "object" ? over.advanced : {};

  const advanced = {
    use_manual_progress: Boolean(
      overAdvanced.use_manual_progress !== undefined
        ? overAdvanced.use_manual_progress
        : baseAdvanced.use_manual_progress
    ),
    use_weighted_progress: Boolean(
      overAdvanced.use_weighted_progress !== undefined
        ? overAdvanced.use_weighted_progress
        : baseAdvanced.use_weighted_progress
    ),
    use_time_progress: Boolean(
      overAdvanced.use_time_progress !== undefined
        ? overAdvanced.use_time_progress
        : baseAdvanced.use_time_progress
    ),
    auto_assign_task_creator: Boolean(
      overAdvanced.auto_assign_task_creator !== undefined
        ? overAdvanced.auto_assign_task_creator
        : baseAdvanced.auto_assign_task_creator
    ),
    restrict_task_creation: Boolean(
      overAdvanced.restrict_task_creation !== undefined
        ? overAdvanced.restrict_task_creation
        : baseAdvanced.restrict_task_creation
    ),
    phase_assignees_enabled: Boolean(
      overAdvanced.phase_assignees_enabled !== undefined
        ? overAdvanced.phase_assignees_enabled
        : baseAdvanced.phase_assignees_enabled
    ),
  };

  let budget: { amount: number | null; currency: string | null } | null = null;
  const hasBudgetOverride = over.budget !== undefined;
  const hasBudgetBase = !!base.budget;
  if (hasBudgetOverride || hasBudgetBase) {
    const bOver = over.budget && typeof over.budget === "object" ? over.budget : {};
    const bBase = base.budget && typeof base.budget === "object" ? base.budget : {};
    const amount =
      bOver.amount !== undefined
        ? bOver.amount === null
          ? null
          : Number(bOver.amount)
        : bBase.amount !== undefined && bBase.amount !== null
          ? Number(bBase.amount)
          : null;
    const currency =
      bOver.currency !== undefined ? bOver.currency || null : bBase.currency || null;
    budget = {
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      currency,
    };
  }

  return {
    category_id,
    project_manager_id,
    working_days,
    man_days,
    hours_per_day,
    advanced,
    budget,
  };
};

/** Calendar-day offset from project start (UTC day). Null if either date is missing. */
export const calendarDayOffset = (
  projectStart: string | Date | null | undefined,
  taskDate: string | Date | null | undefined
): number | null => {
  if (!projectStart || !taskDate) return null;
  const start = new Date(projectStart);
  const date = new Date(taskDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(date.getTime())) return null;
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const dateUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((dateUtc - startUtc) / 86400000);
};

export const applyOffsetDate = (
  projectStart: string | Date,
  offsetDays: number | null | undefined
): string | null => {
  if (offsetDays === null || offsetDays === undefined) return null;
  const n = Number(offsetDays);
  if (!Number.isFinite(n)) return null;
  const start = new Date(projectStart);
  if (Number.isNaN(start.getTime())) return null;
  const result = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  result.setUTCDate(result.getUTCDate() + n);
  return result.toISOString().slice(0, 10);
};

/** Chunk an array for batched async work (Phase 8.1). */
export const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Remap template-local dependency edges to new task ids.
 * Drops unmapped / self edges (returned as skip candidates).
 */
export const remapTemplateDependencies = (
  edges: Array<{
    taskTemplateId: string;
    relatedTemplateId: string;
    dependencyType?: string;
    taskName?: string;
  }>,
  idMap: Map<string, string>
): {
  inserts: Array<{ taskId: string; relatedTaskId: string; dependencyType: string }>;
  skipped: Array<{ taskName?: string; reason: string }>;
} => {
  const inserts: Array<{ taskId: string; relatedTaskId: string; dependencyType: string }> =
    [];
  const skipped: Array<{ taskName?: string; reason: string }> = [];

  for (const edge of edges) {
    const taskId = idMap.get(edge.taskTemplateId);
    const relatedTaskId = idMap.get(edge.relatedTemplateId);
    if (!taskId || !relatedTaskId || relatedTaskId === taskId) {
      skipped.push({
        taskName: edge.taskName || edge.taskTemplateId,
        reason: "unmapped_or_self",
      });
      continue;
    }
    inserts.push({
      taskId,
      relatedTaskId,
      dependencyType: edge.dependencyType || "blocked_by",
    });
  }

  return { inserts, skipped };
};
