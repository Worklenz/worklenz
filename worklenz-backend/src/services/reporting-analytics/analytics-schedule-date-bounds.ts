import moment from "moment-timezone";

/**
 * Relative date presets for analytics schedules.
 * Logic mirrors worklenz-frontend/src/utils/date-presets.ts so UI and email
 * exports stay aligned.
 */
export type ScheduleDatePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_14_days"
  | "last_60_days"
  | "this_quarter"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_30_days"
  | "last_month"
  | "last_3_months"
  | "last_90_days"
  | "all_time"
  | "custom";

export interface ScheduleDateBounds {
  date_from?: string;
  date_to?: string;
}

const RELATIVE_PRESETS = new Set<string>([
  "today",
  "yesterday",
  "last_7_days",
  "last_14_days",
  "last_60_days",
  "this_quarter",
  "this_week",
  "last_week",
  "this_month",
  "last_30_days",
  "last_month",
  "last_3_months",
  "last_90_days",
  "all_time",
]);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function resolveTimezone(tz: string | undefined | null): string {
  const name = (tz || "UTC").trim() || "UTC";
  return moment.tz.zone(name) ? name : "UTC";
}

function fmtDay(day: moment.Moment): string {
  return day.format("YYYY-MM-DD");
}

function toIsoDayStart(day: string): string {
  return `${day}T00:00:00.000Z`;
}

function toIsoDayEnd(day: string): string {
  return `${day}T23:59:59.999Z`;
}

function getPresetRange(
  key: ScheduleDatePreset,
  now: moment.Moment
): { from: string; to: string } | null {
  const today = now.clone().startOf("day");

  switch (key) {
    case "today":
      return { from: fmtDay(today), to: fmtDay(today) };
    case "yesterday": {
      const yesterday = today.clone().subtract(1, "day");
      return { from: fmtDay(yesterday), to: fmtDay(yesterday) };
    }
    case "last_7_days":
      return {
        from: fmtDay(today.clone().subtract(7, "day")),
        to: fmtDay(today.clone().subtract(1, "day")),
      };
    case "last_14_days":
      return {
        from: fmtDay(today.clone().subtract(14, "day")),
        to: fmtDay(today),
      };
    case "last_60_days":
      return {
        from: fmtDay(today.clone().subtract(60, "day")),
        to: fmtDay(today),
      };
    case "this_quarter": {
      const quarterStartMonth = Math.floor(today.month() / 3) * 3;
      const from = today.clone().month(quarterStartMonth).startOf("month");
      return { from: fmtDay(from), to: fmtDay(today) };
    }
    case "this_week":
      return { from: fmtDay(today.clone().startOf("week")), to: fmtDay(today) };
    case "last_week": {
      const previousWeek = today.clone().subtract(1, "week");
      return {
        from: fmtDay(previousWeek.clone().startOf("week")),
        to: fmtDay(previousWeek.clone().endOf("week")),
      };
    }
    case "this_month":
      return { from: fmtDay(today.clone().startOf("month")), to: fmtDay(today) };
    case "last_30_days":
      return {
        from: fmtDay(today.clone().subtract(30, "day")),
        to: fmtDay(today.clone().subtract(1, "day")),
      };
    case "last_month": {
      const previousMonth = today.clone().subtract(1, "month");
      return {
        from: fmtDay(previousMonth.clone().startOf("month")),
        to: fmtDay(previousMonth.clone().endOf("month")),
      };
    }
    case "last_3_months":
      return {
        from: fmtDay(today.clone().subtract(3, "month")),
        to: fmtDay(today),
      };
    case "last_90_days":
      return {
        from: fmtDay(today.clone().subtract(90, "day")),
        to: fmtDay(today.clone().subtract(1, "day")),
      };
    case "all_time":
    default:
      return null;
  }
}

function parseCustomRange(
  customRange: unknown
): { from: string; to: string } | null {
  if (!Array.isArray(customRange) || customRange.length < 2) return null;
  const from = typeof customRange[0] === "string" ? customRange[0].slice(0, 10) : "";
  const to = typeof customRange[1] === "string" ? customRange[1].slice(0, 10) : "";
  if (!DATE_ONLY.test(from) || !DATE_ONLY.test(to)) return null;
  return { from, to };
}

export function isRelativeScheduleDatePreset(preset: unknown): boolean {
  return typeof preset === "string" && RELATIVE_PRESETS.has(preset);
}

/**
 * Resolve analytics date bounds for a scheduled send.
 * Relative presets are evaluated against `now` in the schedule timezone.
 * Custom keeps frozen absolute dates; unknown/missing presets leave input unchanged.
 */
export function resolveScheduleDateBounds(input: {
  datePreset?: unknown;
  customRange?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  timezone?: string | null;
  now?: Date | moment.Moment;
}): ScheduleDateBounds | null {
  const preset =
    typeof input.datePreset === "string" ? (input.datePreset as ScheduleDatePreset) : null;

  if (!preset) {
    return null; // caller keeps existing date_from/date_to
  }

  if (preset === "custom") {
    const custom = parseCustomRange(input.customRange);
    if (custom) {
      return {
        date_from: toIsoDayStart(custom.from),
        date_to: toIsoDayEnd(custom.to),
      };
    }
    // Incomplete custom: keep frozen absolute dates if present
    return null;
  }

  if (!isRelativeScheduleDatePreset(preset)) {
    return null;
  }

  const tz = resolveTimezone(input.timezone);
  const now = moment(input.now ?? new Date()).tz(tz);
  const range = getPresetRange(preset, now);

  if (!range) {
    // all_time — clear absolute bounds
    return {};
  }

  return {
    date_from: toIsoDayStart(range.from),
    date_to: toIsoDayEnd(range.to),
  };
}

/**
 * Apply live date resolution onto a schedule filters payload.
 * Mutates a shallow copy; returns the copy.
 */
export function applyLiveScheduleDateBounds(
  filters: Record<string, unknown>,
  timezone?: string | null,
  now?: Date | moment.Moment
): Record<string, unknown> {
  const next = { ...filters };
  const resolved = resolveScheduleDateBounds({
    datePreset: next.date_preset,
    customRange: next.custom_range,
    dateFrom: next.date_from,
    dateTo: next.date_to,
    timezone,
    now,
  });

  if (resolved === null) {
    return next;
  }

  if (resolved.date_from === undefined && resolved.date_to === undefined) {
    delete next.date_from;
    delete next.date_to;
    return next;
  }

  if (resolved.date_from !== undefined) next.date_from = resolved.date_from;
  if (resolved.date_to !== undefined) next.date_to = resolved.date_to;
  return next;
}

const PRESET_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 days",
  last_14_days: "Last 14 days",
  last_60_days: "Last 60 days",
  this_quarter: "This quarter",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_30_days: "Last 30 days",
  last_month: "Last month",
  last_3_months: "Last 3 months",
  last_90_days: "Last 90 days",
  all_time: "All time",
  custom: "Custom range",
};

function toDayLabel(isoOrDay: string): string {
  const day = String(isoOrDay || "").slice(0, 10);
  if (!DATE_ONLY.test(day)) return day;
  return moment.utc(day, "YYYY-MM-DD").format("D MMM YYYY");
}

function dayFromFilterValue(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const day = value.trim().slice(0, 10);
  return DATE_ONLY.test(day) ? day : null;
}

/**
 * Human-readable time-range note for scheduled report emails.
 * Uses the same live preset resolution as the export at send time.
 *
 * Examples:
 * - "Yesterday (17 Nov 2026)"
 * - "Last 30 days (19 Oct 2026 – 17 Nov 2026)"
 * - "All time"
 */
export function formatScheduleTimeRangeNote(
  filters: Record<string, unknown> | null | undefined,
  timezone?: string | null,
  now?: Date | moment.Moment
): string | null {
  if (!filters || typeof filters !== "object") return null;

  const preset =
    typeof filters.date_preset === "string" ? filters.date_preset : null;
  const resolved = resolveScheduleDateBounds({
    datePreset: filters.date_preset,
    customRange: filters.custom_range,
    dateFrom: filters.date_from,
    dateTo: filters.date_to,
    timezone,
    now,
  });

  let from = resolved?.date_from
    ? String(resolved.date_from).slice(0, 10)
    : dayFromFilterValue(filters.date_from);
  let to = resolved?.date_to
    ? String(resolved.date_to).slice(0, 10)
    : dayFromFilterValue(filters.date_to);

  if (preset === "all_time") return "All time";

  if (!from && !to) {
    if (preset && PRESET_LABELS[preset] && preset !== "custom") {
      return PRESET_LABELS[preset];
    }
    return null;
  }

  if (from && !to) to = from;
  if (to && !from) from = to;

  const rangeLabel =
    from === to ? toDayLabel(from!) : `${toDayLabel(from!)} – ${toDayLabel(to!)}`;
  const presetLabel =
    preset && PRESET_LABELS[preset] ? PRESET_LABELS[preset] : null;

  if (presetLabel && preset !== "custom") {
    return `${presetLabel} (${rangeLabel})`;
  }
  return rangeLabel;
}

function countIds(value: unknown): number {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

/**
 * Compact filter summary for scheduled PDF headers.
 * Example: "Time range: Last 3 months (1 Aug 2026 – 20 Nov 2026) · Projects: All · Teams: 1 selected"
 */
export function formatSchedulePdfFilterDetails(
  filters: Record<string, unknown> | null | undefined,
  timezone?: string | null,
  now?: Date | moment.Moment
): string | null {
  if (!filters || typeof filters !== "object") return null;

  const parts: string[] = [];
  const timeRange = formatScheduleTimeRangeNote(filters, timezone, now);
  if (timeRange) parts.push(`Time range: ${timeRange}`);

  const projectScope =
    typeof filters.project_scope === "string" ? filters.project_scope : null;
  const projectCount = countIds(filters.project_ids);
  if (projectScope === "latest") {
    const limit = Number(filters.chart_project_limit);
    parts.push(
      Number.isFinite(limit) && limit > 0
        ? `Projects: Latest ${limit}`
        : "Projects: Latest"
    );
  } else if (projectCount === 0) {
    parts.push("Projects: All");
  } else {
    parts.push(`Projects: ${projectCount} selected`);
  }

  const teamCount = countIds(filters.team_ids);
  if (teamCount > 0) parts.push(`Teams: ${teamCount} selected`);

  const memberCount = countIds(filters.member_ids);
  if (memberCount > 0) parts.push(`Members: ${memberCount} selected`);

  const healthCount = countIds(filters.health_ids);
  if (healthCount > 0) parts.push(`Health: ${healthCount} selected`);

  const statusCount = countIds(filters.status_ids);
  if (statusCount > 0) parts.push(`Status: ${statusCount} selected`);

  return parts.length ? parts.join(" · ") : null;
}
