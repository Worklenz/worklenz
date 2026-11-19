import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  AnalyticsScheduleFormat,
  AnalyticsScheduleType,
  ScheduleServiceError,
  deleteSchedule,
  getScheduleByReport,
  listSchedules,
  listSchedulesByReport,
  setSchedulePaused,
  updateSchedule,
  upsertSchedule,
} from "../../services/reporting-analytics/analytics-schedules.service";

function sendScheduleError(res: IWorkLenzResponse, error: unknown): IWorkLenzResponse | null {
  if (error instanceof ScheduleServiceError) {
    return res
      .status(error.statusCode)
      .send(new ServerResponse(false, null, error.message));
  }
  return null;
}

function parseFormats(body: Record<string, unknown>): AnalyticsScheduleFormat[] {
  if (Array.isArray(body.formats)) {
    return body.formats.map(v => String(v)) as AnalyticsScheduleFormat[];
  }
  // Backward compatible: single `format` field.
  if (body.format != null) {
    return [String(body.format) as AnalyticsScheduleFormat];
  }
  return ["PDF"];
}

function parseUpsertBody(body: Record<string, unknown>) {
  return {
    reportKind: String(body.report_kind || ""),
    reportName: String(body.report_name || ""),
    templateId:
      typeof body.template_id === "string" && body.template_id
        ? body.template_id
        : null,
    scheduleType: body.schedule_type as AnalyticsScheduleType,
    daysOfWeek: Array.isArray(body.days_of_week) ? (body.days_of_week as number[]) : null,
    dayOfMonth: body.day_of_month == null ? null : Number(body.day_of_month),
    dateOfMonth: body.date_of_month == null ? null : Number(body.date_of_month),
    weekOfMonth: body.week_of_month == null ? null : Number(body.week_of_month),
    intervalDays: body.interval_days == null ? null : Number(body.interval_days),
    intervalWeeks: body.interval_weeks == null ? null : Number(body.interval_weeks),
    intervalMonths: body.interval_months == null ? null : Number(body.interval_months),
    sendTime: String(body.send_time || "08:00"),
    timezone: typeof body.timezone === "string" ? body.timezone : "UTC",
    recipients: Array.isArray(body.recipients) ? (body.recipients as string[]) : [],
    formats: parseFormats(body),
    message: typeof body.message === "string" ? body.message : null,
    filters:
      body.filters && typeof body.filters === "object" && !Array.isArray(body.filters)
        ? (body.filters as Record<string, unknown>)
        : body.filters_json &&
            typeof body.filters_json === "object" &&
            !Array.isArray(body.filters_json)
          ? (body.filters_json as Record<string, unknown>)
          : {},
    paused: !!body.paused,
  };
}

export default class AnalyticsSchedulesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async list(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const rows = await listSchedules(teamId, userId);
    return res.status(200).send(new ServerResponse(true, rows));
  }

  @HandleExceptions()
  public static async getByReport(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const reportKind =
        typeof req.query.report_kind === "string" ? req.query.report_kind : "";
      const templateId =
        typeof req.query.template_id === "string" && req.query.template_id
          ? req.query.template_id
          : null;
      const listAll =
        req.query.all === "1" ||
        req.query.all === "true" ||
        req.query.list === "1" ||
        req.query.list === "true";

      if (listAll) {
        const rows = await listSchedulesByReport(teamId, userId, reportKind, templateId);
        return res.status(200).send(new ServerResponse(true, rows));
      }

      // Legacy single-row response (most recent schedule for this report).
      const row = await getScheduleByReport(teamId, userId, reportKind, templateId);
      return res.status(200).send(new ServerResponse(true, row));
    } catch (error) {
      const handled = sendScheduleError(res, error);
      if (handled) return handled;
      throw error;
    }
  }

  @HandleExceptions()
  public static async upsert(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const row = await upsertSchedule(req.user, parseUpsertBody(req.body ?? {}));
      return res.status(200).send(new ServerResponse(true, row));
    } catch (error) {
      const handled = sendScheduleError(res, error);
      if (handled) return handled;
      throw error;
    }
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const body = req.body ?? {};
      const patch: Parameters<typeof updateSchedule>[2] = {};

      if (body.report_name !== undefined) patch.reportName = String(body.report_name);
      if (body.schedule_type !== undefined) {
        patch.scheduleType = body.schedule_type as AnalyticsScheduleType;
      }
      if (body.days_of_week !== undefined) {
        patch.daysOfWeek = Array.isArray(body.days_of_week)
          ? (body.days_of_week as number[])
          : null;
      }
      if (body.day_of_month !== undefined) {
        patch.dayOfMonth = body.day_of_month == null ? null : Number(body.day_of_month);
      }
      if (body.date_of_month !== undefined) {
        patch.dateOfMonth = body.date_of_month == null ? null : Number(body.date_of_month);
      }
      if (body.week_of_month !== undefined) {
        patch.weekOfMonth = body.week_of_month == null ? null : Number(body.week_of_month);
      }
      if (body.interval_days !== undefined) {
        patch.intervalDays = body.interval_days == null ? null : Number(body.interval_days);
      }
      if (body.interval_weeks !== undefined) {
        patch.intervalWeeks =
          body.interval_weeks == null ? null : Number(body.interval_weeks);
      }
      if (body.interval_months !== undefined) {
        patch.intervalMonths =
          body.interval_months == null ? null : Number(body.interval_months);
      }
      if (body.send_time !== undefined) patch.sendTime = String(body.send_time);
      if (body.timezone !== undefined) patch.timezone = String(body.timezone);
      if (body.recipients !== undefined) {
        patch.recipients = Array.isArray(body.recipients)
          ? (body.recipients as string[])
          : [];
      }
      if (body.formats !== undefined || body.format !== undefined) {
        patch.formats = parseFormats(body);
      }
      if (body.message !== undefined) {
        patch.message = typeof body.message === "string" ? body.message : null;
      }
      if (body.filters !== undefined || body.filters_json !== undefined) {
        const filters = body.filters ?? body.filters_json;
        patch.filters =
          filters && typeof filters === "object" && !Array.isArray(filters)
            ? (filters as Record<string, unknown>)
            : {};
      }
      if (body.paused !== undefined) patch.paused = !!body.paused;

      const row = await updateSchedule(req.user, String(req.params.id), patch);
      return res.status(200).send(new ServerResponse(true, row));
    } catch (error) {
      const handled = sendScheduleError(res, error);
      if (handled) return handled;
      throw error;
    }
  }

  @HandleExceptions()
  public static async setPaused(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const row = await setSchedulePaused(
        req.user,
        String(req.params.id),
        !!req.body?.paused
      );
      return res.status(200).send(new ServerResponse(true, row));
    } catch (error) {
      const handled = sendScheduleError(res, error);
      if (handled) return handled;
      throw error;
    }
  }

  @HandleExceptions()
  public static async remove(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      await deleteSchedule(req.user, String(req.params.id));
      return res.status(200).send(new ServerResponse(true, null, "Deleted"));
    } catch (error) {
      const handled = sendScheduleError(res, error);
      if (handled) return handled;
      throw error;
    }
  }
}
