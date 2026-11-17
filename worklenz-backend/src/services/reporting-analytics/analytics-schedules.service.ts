import i18next from "../../config/i18n";
import db from "../../config/db";
import { IPassportSession } from "../../interfaces/passport-session";
import {
  ANALYTICS_REPORT_KINDS,
  TEMPLATE_FILTERS_MAX_BYTES,
  TEMPLATE_NAME_MAX_LENGTH,
} from "../../shared/reporting-analytics.constants";
import { isValidateEmail } from "../../shared/utils";
import { isValidUuid } from "../../shared/validation-helpers";
import {
  AnalyticsScheduleCadence,
  AnalyticsScheduleType,
  computeNextSendAt,
} from "./analytics-schedule-next-send";

export type { AnalyticsScheduleType };

const REPORT_NAME_MAX = Math.min(TEMPLATE_NAME_MAX_LENGTH * 2, 120);
const MAX_RECIPIENTS = 25;
const SCHEDULE_TYPES: AnalyticsScheduleType[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "every_x_days",
  "every_x_weeks",
  "every_x_months",
];
const FORMATS = ["PDF", "CSV", "Excel"] as const;

export type AnalyticsScheduleFormat = (typeof FORMATS)[number];

export interface AnalyticsScheduleRow {
  id: string;
  team_id: string;
  owner_id: string;
  report_kind: string;
  report_name: string;
  template_id: string | null;
  schedule_type: AnalyticsScheduleType;
  days_of_week: number[] | null;
  day_of_month: number | null;
  date_of_month: number | null;
  week_of_month: number | null;
  interval_days: number | null;
  interval_weeks: number | null;
  interval_months: number | null;
  send_time: string;
  timezone: string;
  recipients: string[];
  format: AnalyticsScheduleFormat;
  message: string | null;
  filters_json: Record<string, unknown>;
  paused: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ScheduleServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ScheduleServiceError";
  }
}

export interface UpsertScheduleInput {
  reportKind: string;
  reportName: string;
  templateId?: string | null;
  scheduleType: AnalyticsScheduleType;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
  dateOfMonth?: number | null;
  weekOfMonth?: number | null;
  intervalDays?: number | null;
  intervalWeeks?: number | null;
  intervalMonths?: number | null;
  sendTime: string;
  timezone?: string;
  recipients: string[];
  format: AnalyticsScheduleFormat;
  message?: string | null;
  filters?: Record<string, unknown>;
  paused?: boolean;
}

const SELECT_COLS = `
  id, team_id, owner_id, report_kind, report_name, template_id,
  schedule_type, days_of_week, day_of_month, date_of_month, week_of_month,
  interval_days, interval_weeks, interval_months,
  to_char(send_time, 'HH24:MI') AS send_time,
  timezone, recipients, format, message, filters_json,
  paused, last_sent_at, next_send_at, created_at, updated_at
`;

function mapRow(row: Record<string, unknown>): AnalyticsScheduleRow {
  const filters =
    row.filters_json && typeof row.filters_json === "object" && !Array.isArray(row.filters_json)
      ? (row.filters_json as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    team_id: String(row.team_id),
    owner_id: String(row.owner_id),
    report_kind: String(row.report_kind),
    report_name: String(row.report_name),
    template_id: row.template_id ? String(row.template_id) : null,
    schedule_type: row.schedule_type as AnalyticsScheduleType,
    days_of_week: Array.isArray(row.days_of_week) ? (row.days_of_week as number[]) : null,
    day_of_month: row.day_of_month == null ? null : Number(row.day_of_month),
    date_of_month: row.date_of_month == null ? null : Number(row.date_of_month),
    week_of_month: row.week_of_month == null ? null : Number(row.week_of_month),
    interval_days: row.interval_days == null ? null : Number(row.interval_days),
    interval_weeks: row.interval_weeks == null ? null : Number(row.interval_weeks),
    interval_months: row.interval_months == null ? null : Number(row.interval_months),
    send_time: String(row.send_time || "08:00").slice(0, 5),
    timezone: String(row.timezone || "UTC"),
    recipients: Array.isArray(row.recipients) ? (row.recipients as string[]) : [],
    format: row.format as AnalyticsScheduleFormat,
    message: row.message == null ? null : String(row.message),
    filters_json: filters,
    paused: !!row.paused,
    last_sent_at: row.last_sent_at ? String(row.last_sent_at) : null,
    next_send_at: row.next_send_at ? String(row.next_send_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeReportName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.reportNameRequired", {
        defaultValue: "Report name is required",
      })
    );
  }
  const trimmed = name.trim();
  if (trimmed.length > REPORT_NAME_MAX) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.reportNameTooLong", {
        defaultValue: "Report name must be at most {{max}} characters",
        max: REPORT_NAME_MAX,
      })
    );
  }
  return trimmed;
}

function normalizeRecipients(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.recipientsRequired", {
        defaultValue: "Add at least one recipient",
      })
    );
  }
  const emails = [
    ...new Set(
      raw
        .map(e => (typeof e === "string" ? e.trim().toLowerCase() : ""))
        .filter(Boolean)
    ),
  ];
  if (!emails.length) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.recipientsRequired", {
        defaultValue: "Add at least one recipient",
      })
    );
  }
  if (emails.length > MAX_RECIPIENTS) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.tooManyRecipients", {
        defaultValue: "You can add at most {{max}} recipients",
        max: MAX_RECIPIENTS,
      })
    );
  }
  for (const email of emails) {
    if (!isValidateEmail(email)) {
      throw new ScheduleServiceError(
        i18next.t("analyticsSchedules.invalidEmail", {
          defaultValue: "Invalid recipient email: {{email}}",
          email,
        })
      );
    }
  }
  return emails;
}

function normalizeSendTime(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.invalidSendTime", {
        defaultValue: "Send time must be HH:mm",
      })
    );
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.invalidSendTime", {
        defaultValue: "Send time must be HH:mm",
      })
    );
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeFilters(raw: unknown): Record<string, unknown> {
  const filters = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const json = JSON.stringify(filters);
  if (Buffer.byteLength(json, "utf8") > TEMPLATE_FILTERS_MAX_BYTES) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.filtersTooLarge", {
        defaultValue: "Schedule filters must be at most {{limit}} bytes",
        limit: TEMPLATE_FILTERS_MAX_BYTES,
      })
    );
  }
  return filters;
}

function normalizeCadence(input: UpsertScheduleInput): {
  scheduleType: AnalyticsScheduleType;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  dateOfMonth: number | null;
  weekOfMonth: number | null;
  intervalDays: number | null;
  intervalWeeks: number | null;
  intervalMonths: number | null;
  sendTime: string;
  timezone: string;
} {
  if (!SCHEDULE_TYPES.includes(input.scheduleType)) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.invalidScheduleType", {
        defaultValue: "Invalid schedule frequency",
      })
    );
  }

  const sendTime = normalizeSendTime(input.sendTime);
  const timezone =
    typeof input.timezone === "string" && input.timezone.trim()
      ? input.timezone.trim()
      : "UTC";

  let daysOfWeek: number[] | null = null;
  let dayOfMonth: number | null = null;
  let dateOfMonth: number | null = null;
  let weekOfMonth: number | null = null;
  let intervalDays: number | null = null;
  let intervalWeeks: number | null = null;
  let intervalMonths: number | null = null;

  switch (input.scheduleType) {
    case "weekly": {
      const days = Array.isArray(input.daysOfWeek)
        ? [...new Set(input.daysOfWeek.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))]
        : [];
      if (!days.length) {
        throw new ScheduleServiceError(
          i18next.t("analyticsSchedules.daysOfWeekRequired", {
            defaultValue: "Select at least one day of the week",
          })
        );
      }
      daysOfWeek = days;
      break;
    }
    case "monthly": {
      if (input.dateOfMonth != null) {
        const date = Number(input.dateOfMonth);
        if (!Number.isInteger(date) || date < 1 || date > 28) {
          throw new ScheduleServiceError(
            i18next.t("analyticsSchedules.invalidDateOfMonth", {
              defaultValue: "Date of month must be between 1 and 28",
            })
          );
        }
        dateOfMonth = date;
      } else if (input.weekOfMonth != null && input.dayOfMonth != null) {
        const week = Number(input.weekOfMonth);
        const day = Number(input.dayOfMonth);
        if (!Number.isInteger(week) || week < 1 || week > 5) {
          throw new ScheduleServiceError(
            i18next.t("analyticsSchedules.invalidWeekOfMonth", {
              defaultValue: "Week of month must be between 1 and 5",
            })
          );
        }
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          throw new ScheduleServiceError(
            i18next.t("analyticsSchedules.invalidDayOfMonth", {
              defaultValue: "Day of week must be between 0 and 6",
            })
          );
        }
        weekOfMonth = week;
        dayOfMonth = day;
      } else {
        throw new ScheduleServiceError(
          i18next.t("analyticsSchedules.monthlyDetailsRequired", {
            defaultValue: "Choose a date of month or a week and day",
          })
        );
      }
      break;
    }
    case "every_x_days": {
      const n = Number(input.intervalDays ?? 0);
      if (!Number.isInteger(n) || n < 1) {
        throw new ScheduleServiceError(
          i18next.t("analyticsSchedules.invalidIntervalDays", {
            defaultValue: "Interval days must be at least 1",
          })
        );
      }
      intervalDays = n;
      break;
    }
    case "every_x_weeks": {
      const n = Number(input.intervalWeeks ?? 0);
      if (!Number.isInteger(n) || n < 1) {
        throw new ScheduleServiceError(
          i18next.t("analyticsSchedules.invalidIntervalWeeks", {
            defaultValue: "Interval weeks must be at least 1",
          })
        );
      }
      intervalWeeks = n;
      break;
    }
    case "every_x_months": {
      const n = Number(input.intervalMonths ?? 0);
      if (!Number.isInteger(n) || n < 1) {
        throw new ScheduleServiceError(
          i18next.t("analyticsSchedules.invalidIntervalMonths", {
            defaultValue: "Interval months must be at least 1",
          })
        );
      }
      intervalMonths = n;
      break;
    }
    default:
      break;
  }

  return {
    scheduleType: input.scheduleType,
    daysOfWeek,
    dayOfMonth,
    dateOfMonth,
    weekOfMonth,
    intervalDays,
    intervalWeeks,
    intervalMonths,
    sendTime,
    timezone,
  };
}

function toCadence(
  scheduleType: AnalyticsScheduleType,
  daysOfWeek: number[] | null,
  dayOfMonth: number | null,
  dateOfMonth: number | null,
  weekOfMonth: number | null,
  intervalDays: number | null,
  intervalWeeks: number | null,
  intervalMonths: number | null,
  sendTime: string,
  timezone: string
): AnalyticsScheduleCadence {
  return {
    schedule_type: scheduleType,
    days_of_week: daysOfWeek,
    day_of_month: dayOfMonth,
    date_of_month: dateOfMonth,
    week_of_month: weekOfMonth,
    interval_days: intervalDays,
    interval_weeks: intervalWeeks,
    interval_months: intervalMonths,
    send_time: sendTime,
    timezone,
  };
}

export async function listSchedules(
  teamId: string,
  userId: string
): Promise<AnalyticsScheduleRow[]> {
  const result = await db.query(
    `SELECT ${SELECT_COLS}
     FROM analytics_report_schedules
     WHERE team_id = $1::UUID AND owner_id = $2::UUID
     ORDER BY next_send_at NULLS LAST, updated_at DESC`,
    [teamId, userId]
  );
  return result.rows.map(mapRow);
}

export async function getScheduleByReport(
  teamId: string,
  userId: string,
  reportKind: string,
  templateId?: string | null
): Promise<AnalyticsScheduleRow | null> {
  if (!ANALYTICS_REPORT_KINDS.some(k => k === reportKind)) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.unsupportedReportKind", {
        defaultValue: "Unsupported report kind",
      })
    );
  }

  if (templateId) {
    if (!isValidUuid(templateId)) {
      throw new ScheduleServiceError("Invalid template id", 400);
    }
    const result = await db.query(
      `SELECT ${SELECT_COLS}
       FROM analytics_report_schedules
       WHERE team_id = $1::UUID
         AND owner_id = $2::UUID
         AND template_id = $3::UUID
       LIMIT 1`,
      [teamId, userId, templateId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  const result = await db.query(
    `SELECT ${SELECT_COLS}
     FROM analytics_report_schedules
     WHERE team_id = $1::UUID
       AND owner_id = $2::UUID
       AND report_kind = $3
       AND template_id IS NULL
     LIMIT 1`,
    [teamId, userId, reportKind]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

async function assertTemplateBelongsToTeam(
  teamId: string,
  userId: string,
  templateId: string,
  reportKind: string
): Promise<void> {
  const result = await db.query(
    `SELECT id FROM analytics_report_templates
     WHERE id = $1::UUID
       AND team_id = $2::UUID
       AND report_kind = $3
       AND (owner_id = $4::UUID OR is_workspace_shared IS TRUE)
     LIMIT 1`,
    [templateId, teamId, reportKind, userId]
  );
  if (!result.rows[0]) {
    throw new ScheduleServiceError("Template not found", 404);
  }
}

export async function upsertSchedule(
  user: IPassportSession,
  input: UpsertScheduleInput
): Promise<AnalyticsScheduleRow> {
  const teamId = user.team_id;
  const userId = user.id;
  if (!teamId || !userId) throw new ScheduleServiceError("Unauthorized", 401);

  if (!ANALYTICS_REPORT_KINDS.some(k => k === input.reportKind)) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.unsupportedReportKind", {
        defaultValue: "Unsupported report kind",
      })
    );
  }

  if (!FORMATS.includes(input.format)) {
    throw new ScheduleServiceError(
      i18next.t("analyticsSchedules.invalidFormat", {
        defaultValue: "Format must be PDF, CSV, or Excel",
      })
    );
  }

  const reportName = normalizeReportName(input.reportName);
  const recipients = normalizeRecipients(input.recipients);
  const filters = normalizeFilters(input.filters);
  const cadence = normalizeCadence(input);
  const paused = !!input.paused;

  const templateId =
    typeof input.templateId === "string" && input.templateId.trim()
      ? input.templateId.trim()
      : null;
  if (templateId) {
    if (!isValidUuid(templateId)) {
      throw new ScheduleServiceError("Invalid template id", 400);
    }
    await assertTemplateBelongsToTeam(teamId, userId, templateId, input.reportKind);
  }

  const nextSendAt = paused
    ? null
    : computeNextSendAt(
        toCadence(
          cadence.scheduleType,
          cadence.daysOfWeek,
          cadence.dayOfMonth,
          cadence.dateOfMonth,
          cadence.weekOfMonth,
          cadence.intervalDays,
          cadence.intervalWeeks,
          cadence.intervalMonths,
          cadence.sendTime,
          cadence.timezone
        )
      );

  const existing = templateId
    ? await db.query(
        `SELECT id FROM analytics_report_schedules
         WHERE owner_id = $1::UUID AND template_id = $2::UUID
         LIMIT 1`,
        [userId, templateId]
      )
    : await db.query(
        `SELECT id FROM analytics_report_schedules
         WHERE owner_id = $1::UUID AND report_kind = $2 AND template_id IS NULL
         LIMIT 1`,
        [userId, input.reportKind]
      );

  if (existing.rows[0]) {
    const updated = await db.query(
      `UPDATE analytics_report_schedules SET
         report_kind = $3,
         report_name = $4,
         schedule_type = $5::SCHEDULE_TYPE,
         days_of_week = $6::INT[],
         day_of_month = $7,
         date_of_month = $8,
         week_of_month = $9,
         interval_days = $10,
         interval_weeks = $11,
         interval_months = $12,
         send_time = $13::TIME,
         timezone = $14,
         recipients = $15::TEXT[],
         format = $16,
         message = $17,
         filters_json = $18::jsonb,
         paused = $19,
         next_send_at = $20,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::UUID AND owner_id = $2::UUID
       RETURNING ${SELECT_COLS}`,
      [
        existing.rows[0].id,
        userId,
        input.reportKind,
        reportName,
        cadence.scheduleType,
        cadence.daysOfWeek,
        cadence.dayOfMonth,
        cadence.dateOfMonth,
        cadence.weekOfMonth,
        cadence.intervalDays,
        cadence.intervalWeeks,
        cadence.intervalMonths,
        cadence.sendTime,
        cadence.timezone,
        recipients,
        input.format,
        input.message?.trim() || null,
        JSON.stringify(filters),
        paused,
        nextSendAt,
      ]
    );
    return mapRow(updated.rows[0]);
  }

  const inserted = await db.query(
    `INSERT INTO analytics_report_schedules (
       team_id, owner_id, report_kind, report_name, template_id,
       schedule_type, days_of_week, day_of_month, date_of_month, week_of_month,
       interval_days, interval_weeks, interval_months,
       send_time, timezone, recipients, format, message, filters_json,
       paused, next_send_at
     ) VALUES (
       $1::UUID, $2::UUID, $3, $4, $5::UUID,
       $6::SCHEDULE_TYPE, $7::INT[], $8, $9, $10,
       $11, $12, $13,
       $14::TIME, $15, $16::TEXT[], $17, $18, $19::jsonb,
       $20, $21
     )
     RETURNING ${SELECT_COLS}`,
    [
      teamId,
      userId,
      input.reportKind,
      reportName,
      templateId,
      cadence.scheduleType,
      cadence.daysOfWeek,
      cadence.dayOfMonth,
      cadence.dateOfMonth,
      cadence.weekOfMonth,
      cadence.intervalDays,
      cadence.intervalWeeks,
      cadence.intervalMonths,
      cadence.sendTime,
      cadence.timezone,
      recipients,
      input.format,
      input.message?.trim() || null,
      JSON.stringify(filters),
      paused,
      nextSendAt,
    ]
  );
  return mapRow(inserted.rows[0]);
}

export async function updateSchedule(
  user: IPassportSession,
  scheduleId: string,
  input: Partial<UpsertScheduleInput> & { paused?: boolean }
): Promise<AnalyticsScheduleRow> {
  if (!user.team_id || !user.id) throw new ScheduleServiceError("Unauthorized", 401);
  if (!isValidUuid(scheduleId)) throw new ScheduleServiceError("Invalid schedule id", 400);

  const existingResult = await db.query(
    `SELECT ${SELECT_COLS}
     FROM analytics_report_schedules
     WHERE id = $1::UUID AND team_id = $2::UUID AND owner_id = $3::UUID
     LIMIT 1`,
    [scheduleId, user.team_id, user.id]
  );
  if (!existingResult.rows[0]) {
    throw new ScheduleServiceError("Schedule not found", 404);
  }

  const existing = mapRow(existingResult.rows[0]);
  const merged: UpsertScheduleInput = {
    reportKind: input.reportKind ?? existing.report_kind,
    reportName: input.reportName ?? existing.report_name,
    templateId: existing.template_id,
    scheduleType: input.scheduleType ?? existing.schedule_type,
    daysOfWeek: input.daysOfWeek !== undefined ? input.daysOfWeek : existing.days_of_week,
    dayOfMonth: input.dayOfMonth !== undefined ? input.dayOfMonth : existing.day_of_month,
    dateOfMonth: input.dateOfMonth !== undefined ? input.dateOfMonth : existing.date_of_month,
    weekOfMonth: input.weekOfMonth !== undefined ? input.weekOfMonth : existing.week_of_month,
    intervalDays: input.intervalDays !== undefined ? input.intervalDays : existing.interval_days,
    intervalWeeks:
      input.intervalWeeks !== undefined ? input.intervalWeeks : existing.interval_weeks,
    intervalMonths:
      input.intervalMonths !== undefined ? input.intervalMonths : existing.interval_months,
    sendTime: input.sendTime ?? existing.send_time,
    timezone: input.timezone ?? existing.timezone,
    recipients: input.recipients ?? existing.recipients,
    format: input.format ?? existing.format,
    message: input.message !== undefined ? input.message : existing.message,
    filters: input.filters ?? existing.filters_json,
    paused: input.paused !== undefined ? input.paused : existing.paused,
  };

  // Reuse upsert path so validation + next_send_at stay consistent
  return upsertSchedule(user, merged);
}

export async function setSchedulePaused(
  user: IPassportSession,
  scheduleId: string,
  paused: boolean
): Promise<AnalyticsScheduleRow> {
  return updateSchedule(user, scheduleId, { paused });
}

export async function deleteSchedule(
  user: IPassportSession,
  scheduleId: string
): Promise<void> {
  if (!user.team_id || !user.id) throw new ScheduleServiceError("Unauthorized", 401);
  if (!isValidUuid(scheduleId)) throw new ScheduleServiceError("Invalid schedule id", 400);

  const result = await db.query(
    `DELETE FROM analytics_report_schedules
     WHERE id = $1::UUID AND team_id = $2::UUID AND owner_id = $3::UUID
     RETURNING id`,
    [scheduleId, user.team_id, user.id]
  );
  if (!result.rows[0]) {
    throw new ScheduleServiceError("Schedule not found", 404);
  }
}

/** Due schedules for the send cron (oldest due first). */
export async function listDueSchedules(limit = 20): Promise<AnalyticsScheduleRow[]> {
  const result = await db.query(
    `SELECT ${SELECT_COLS}
     FROM analytics_report_schedules
     WHERE paused IS FALSE
       AND next_send_at IS NOT NULL
       AND next_send_at <= CURRENT_TIMESTAMP
     ORDER BY next_send_at ASC
     LIMIT $1`,
    [Math.max(1, Math.min(limit, 100))]
  );
  return result.rows.map(mapRow);
}

/**
 * Claim a due row, stamp last_sent_at, and advance next_send_at.
 * Returns null when another worker already claimed/advanced it.
 */
export async function markScheduleSent(
  schedule: AnalyticsScheduleRow,
  sentAt: Date = new Date()
): Promise<AnalyticsScheduleRow | null> {
  const nextSendAt = computeNextSendAt(
    toCadence(
      schedule.schedule_type,
      schedule.days_of_week,
      schedule.day_of_month,
      schedule.date_of_month,
      schedule.week_of_month,
      schedule.interval_days,
      schedule.interval_weeks,
      schedule.interval_months,
      schedule.send_time,
      schedule.timezone
    ),
    sentAt,
    { includeCurrentSlot: false }
  );

  const result = await db.query(
    `UPDATE analytics_report_schedules
     SET last_sent_at = $2,
         next_send_at = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::UUID
       AND paused IS FALSE
       AND next_send_at IS NOT NULL
       AND next_send_at <= $2
     RETURNING ${SELECT_COLS}`,
    [schedule.id, sentAt, nextSendAt]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/** Push next_send_at forward without marking a successful send (after a hard failure). */
export async function bumpScheduleNextSend(
  schedule: AnalyticsScheduleRow,
  from: Date = new Date()
): Promise<void> {
  const nextSendAt = computeNextSendAt(
    toCadence(
      schedule.schedule_type,
      schedule.days_of_week,
      schedule.day_of_month,
      schedule.date_of_month,
      schedule.week_of_month,
      schedule.interval_days,
      schedule.interval_weeks,
      schedule.interval_months,
      schedule.send_time,
      schedule.timezone
    ),
    from,
    { includeCurrentSlot: false }
  );
  await db.query(
    `UPDATE analytics_report_schedules
     SET next_send_at = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::UUID`,
    [schedule.id, nextSendAt]
  );
}
