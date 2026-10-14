import moment from "moment-timezone";
import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import WorklenzControllerBase from "../../worklenz-controller-base";
import {
  getBillableTaskStats,
  getBillableTimeLogStats,
  getCapacityVsLogged,
  getClientStats,
  getIncompleteTasksByProject,
  getOverdueTasksGrouped,
  getProjectHealthStats,
  getProjectStatsByStatus,
  getTasksByStatus,
  getTeamUtilization,
  getTimeLoggedVsEstimated,
  getUpcomingTasks,
  ProjectWidgetFilters,
  TaskGroupBy,
} from "../../../services/reporting-project-widgets-stats.service";
import {
  getProgressChart,
  getProgressChartOptions,
  PROGRESS_METRICS,
  PROGRESS_SCOPES,
  PROGRESS_SOURCES,
  ProgressChartError,
  ProgressChartFilters,
} from "../../../services/reporting-progress-chart.service";
import {
  DEFAULT_SPRINT_COUNT,
  getVelocity,
  VELOCITY_METRICS,
  VelocityError,
  VelocityFilters,
} from "../../../services/reporting-velocity.service";
import {
  FLOW_SCOPES,
  FlowError,
  FlowFilters,
  getCumulativeFlow,
  getTimeInStatus,
} from "../../../services/reporting-flow.service";
import { isValidUuid } from "../../../shared/validation-helpers";

const WIDGET_TYPES = [
  "project_stats_by_status",
  "tasks_by_status",
  "time_logged_vs_estimated",
  "capacity_vs_logged",
  "team_utilization",
  "billable_tasks",
  "billable_time_logs",
  "client_stats",
  "project_health_stats",
  "incomplete_tasks_by_project",
  "upcoming_tasks",
  "overdue_tasks",
] as const;
type WidgetType = (typeof WIDGET_TYPES)[number];

const GROUP_BY_VALUES: TaskGroupBy[] = ["assignee", "project"];

const splitIds = (value: unknown): string[] | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const ids = value.split(",").map(id => id.trim()).filter(Boolean);
  return ids.length ? ids : undefined;
};

const BILLABLE_VALUES = ["all", "billable", "nonBillable"];
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDate = (value: unknown): string | undefined | null => {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value) || !moment.utc(value, "YYYY-MM-DD", true).isValid()) return null;
  return value;
};

export default class ReportingProjectWidgetsController extends WorklenzControllerBase {
  /**
   * GET /reporting/projects/widgets/stats - computes the requested widgets' data in one round
   * trip. Backs the extra Reports > Overview widgets (project/task/time/billable/client stats);
   * layout and per-widget filter config for those widgets live with the rest of the Overview grid
   * (reporting-overview-layout.service.ts), not here - this endpoint is stateless and just takes
   * whatever filters it is given. `widgets` is a comma list of widget types; omitted means "all".
   */
  @HandleExceptions()
  public static async getStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id as string;
    const userId = req.user?.id as string;

    const requested = splitIds(req.query.widgets) as WidgetType[] | undefined;
    const wanted = new Set<WidgetType>(
      requested?.filter((type): type is WidgetType => (WIDGET_TYPES as readonly string[]).includes(type)) ?? WIDGET_TYPES
    );

    const billableParam = req.query.billable as string | undefined;
    const billable = billableParam && BILLABLE_VALUES.includes(billableParam) ? (billableParam as ProjectWidgetFilters["billable"]) : "all";

    // Each widget request is for a single widget (see overview-widgets-stats.api.service.ts), so
    // one `groupBy` param is enough; Upcoming Tasks and Overdue Tasks just default it differently.
    const groupByParam = req.query.groupBy as string | undefined;
    const groupBy = groupByParam && GROUP_BY_VALUES.includes(groupByParam as TaskGroupBy) ? (groupByParam as TaskGroupBy) : undefined;

    const dateFrom = req.query.dateFrom ? moment.utc(req.query.dateFrom as string).startOf("day").toISOString() : undefined;
    const dateTo = req.query.dateTo ? moment.utc(req.query.dateTo as string).endOf("day").toISOString() : undefined;

    const filters: ProjectWidgetFilters = {
      teamId,
      userId,
      projectIds: splitIds(req.query.projects),
      teamIds: splitIds(req.query.teams),
      clientIds: splitIds(req.query.clients),
      categoryIds: splitIds(req.query.categories),
      memberIds: splitIds(req.query.members),
      includeArchived: req.query.archived === "true",
      billable,
      dateFrom,
      dateTo,
    };

    // Working days for the capacity widgets: business days between dateFrom/dateTo, defaulting to
    // the last 30 days when no range is given, mirroring the allocation report's own default window.
    const rangeStart = dateFrom ? moment.utc(dateFrom) : moment.utc().subtract(30, "days").startOf("day");
    const rangeEnd = dateTo ? moment.utc(dateTo) : moment.utc().endOf("day");
    let workingDays = 0;
    const cursor = rangeStart.clone();
    while (cursor.isSameOrBefore(rangeEnd, "day")) {
      if (cursor.isoWeekday() <= 5) workingDays++;
      cursor.add(1, "day");
    }
    workingDays = Math.max(workingDays, 1);

    const body: Partial<Record<WidgetType, unknown>> = {};

    await Promise.all([
      wanted.has("project_stats_by_status") ? getProjectStatsByStatus(filters).then(r => (body.project_stats_by_status = r)) : null,
      wanted.has("tasks_by_status") ? getTasksByStatus(filters).then(r => (body.tasks_by_status = r)) : null,
      wanted.has("time_logged_vs_estimated") ? getTimeLoggedVsEstimated(filters).then(r => (body.time_logged_vs_estimated = r)) : null,
      wanted.has("capacity_vs_logged") ? getCapacityVsLogged(filters, workingDays).then(r => (body.capacity_vs_logged = r)) : null,
      wanted.has("team_utilization") ? getTeamUtilization(filters, workingDays).then(r => (body.team_utilization = r)) : null,
      wanted.has("billable_tasks") ? getBillableTaskStats(filters).then(r => (body.billable_tasks = r)) : null,
      wanted.has("billable_time_logs") ? getBillableTimeLogStats(filters).then(r => (body.billable_time_logs = r)) : null,
      wanted.has("client_stats") ? getClientStats(filters).then(r => (body.client_stats = r)) : null,
      wanted.has("project_health_stats") ? getProjectHealthStats(filters).then(r => (body.project_health_stats = r)) : null,
      wanted.has("incomplete_tasks_by_project") ? getIncompleteTasksByProject(filters).then(r => (body.incomplete_tasks_by_project = r)) : null,
      wanted.has("upcoming_tasks") ? getUpcomingTasks(filters, groupBy ?? "assignee").then(r => (body.upcoming_tasks = r)) : null,
      wanted.has("overdue_tasks") ? getOverdueTasksGrouped(filters, groupBy ?? "project").then(r => (body.overdue_tasks = r)) : null,
    ]);

    return res.status(200).send(new ServerResponse(true, body));
  }

  /**
   * GET /reporting/projects/widgets/progress-chart - burnup / burndown series for one widget.
   * Scope is the viewer's active team ("team") or one of its projects ("project", optionally one
   * sprint). Stateless: the widget's own config is sent as query params.
   */
  @HandleExceptions()
  public static async getProgressChart(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const scope = (req.query.scope as string) || "team";
    const source = (req.query.source as string) || "range";
    const metric = (req.query.metric as string) || "story_points";
    const projectId = req.query.projectId as string | undefined;
    const sprintId = req.query.sprintId as string | undefined;
    const dateFrom = parseIsoDate(req.query.dateFrom);
    const dateTo = parseIsoDate(req.query.dateTo);

    if (!(PROGRESS_SCOPES as readonly string[]).includes(scope)) return res.status(400).send(new ServerResponse(false, null, "Invalid scope"));
    if (!(PROGRESS_SOURCES as readonly string[]).includes(source)) return res.status(400).send(new ServerResponse(false, null, "Invalid source"));
    if (!(PROGRESS_METRICS as readonly string[]).includes(metric)) return res.status(400).send(new ServerResponse(false, null, "Invalid metric"));
    if (dateFrom === null || dateTo === null) return res.status(400).send(new ServerResponse(false, null, "Dates must be YYYY-MM-DD"));
    if ((projectId && !isValidUuid(projectId)) || (sprintId && !isValidUuid(sprintId))) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid id"));
    }

    const filters: ProgressChartFilters = {
      teamId: req.user?.team_id as string,
      userId: req.user?.id as string,
      scope: scope as ProgressChartFilters["scope"],
      source: scope === "project" ? (source as ProgressChartFilters["source"]) : "range",
      metric: metric as ProgressChartFilters["metric"],
      projectId,
      sprintId,
      includeSubtasks: req.query.includeSubtasks === "true",
      includeArchived: req.query.archived === "true",
      dateFrom,
      dateTo,
      forecast: req.query.forecast !== "false",
    };

    try {
      return res.status(200).send(new ServerResponse(true, await getProgressChart(filters)));
    } catch (error) {
      if (error instanceof ProgressChartError) return res.status(error.status).send(new ServerResponse(false, null, error.message));
      throw error;
    }
  }

  /** GET /reporting/projects/widgets/progress-chart/options - project + sprint pickers for the widget settings. */
  @HandleExceptions()
  public static async getProgressChartOptions(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.projectId as string | undefined;
    if (projectId && !isValidUuid(projectId)) return res.status(400).send(new ServerResponse(false, null, "Invalid id"));
    const options = await getProgressChartOptions(req.user?.team_id as string, req.user?.id as string, projectId);
    return res.status(200).send(new ServerResponse(true, options));
  }

  /**
   * GET /reporting/projects/widgets/velocity - committed vs completed work for a project's recent
   * sprints. Velocity is a per-project measure, so a project is required.
   */
  @HandleExceptions()
  public static async getVelocity(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const metric = (req.query.metric as string) || "story_points";
    const projectId = req.query.projectId as string | undefined;
    const sprintCount = req.query.sprintCount === undefined ? DEFAULT_SPRINT_COUNT : Number(req.query.sprintCount);

    if (!(VELOCITY_METRICS as readonly string[]).includes(metric)) return res.status(400).send(new ServerResponse(false, null, "Invalid metric"));
    if (!projectId || !isValidUuid(projectId)) return res.status(400).send(new ServerResponse(false, null, "A valid project is required"));
    if (!Number.isInteger(sprintCount)) return res.status(400).send(new ServerResponse(false, null, "Invalid sprint count"));

    const filters: VelocityFilters = {
      teamId: req.user?.team_id as string,
      projectId,
      metric: metric as VelocityFilters["metric"],
      includeSubtasks: req.query.includeSubtasks === "true",
      sprintCount,
    };

    try {
      return res.status(200).send(new ServerResponse(true, await getVelocity(filters)));
    } catch (error) {
      if (error instanceof VelocityError) return res.status(error.status).send(new ServerResponse(false, null, error.message));
      throw error;
    }
  }

  /** Parses the query shared by the cumulative flow and time in status endpoints; null means a 400 was sent. */
  private static parseFlowFilters(req: IWorkLenzRequest, res: IWorkLenzResponse): FlowFilters | null {
    const scope = (req.query.scope as string) || "team";
    const projectId = req.query.projectId as string | undefined;
    const dateFrom = parseIsoDate(req.query.dateFrom);
    const dateTo = parseIsoDate(req.query.dateTo);
    const assigneeId = (req.query.assigneeId as string | undefined) || undefined;

    const fail = (message: string): null => {
      res.status(400).send(new ServerResponse(false, null, message));
      return null;
    };
    if (!(FLOW_SCOPES as readonly string[]).includes(scope)) return fail("Invalid scope");
    if (dateFrom === null || dateTo === null) return fail("Dates must be YYYY-MM-DD");
    if ((projectId && !isValidUuid(projectId)) || (assigneeId && !isValidUuid(assigneeId))) return fail("Invalid id");

    return {
      teamId: req.user?.team_id as string,
      userId: req.user?.id as string,
      scope: scope as FlowFilters["scope"],
      projectId,
      includeSubtasks: req.query.includeSubtasks === "true",
      includeArchived: req.query.archived === "true",
      assigneeId,
      dateFrom,
      dateTo,
    };
  }

  /** GET /reporting/projects/widgets/cumulative-flow - tasks per status (project) or status category (team) per day. */
  @HandleExceptions()
  public static async getCumulativeFlow(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse | void> {
    const filters = ReportingProjectWidgetsController.parseFlowFilters(req, res);
    if (!filters) return;
    try {
      return res.status(200).send(new ServerResponse(true, await getCumulativeFlow(filters)));
    } catch (error) {
      if (error instanceof FlowError) return res.status(error.status).send(new ServerResponse(false, null, error.message));
      throw error;
    }
  }

  /** GET /reporting/projects/widgets/time-in-status - how long tasks spent in each open status within the window. */
  @HandleExceptions()
  public static async getTimeInStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse | void> {
    const filters = ReportingProjectWidgetsController.parseFlowFilters(req, res);
    if (!filters) return;
    try {
      return res.status(200).send(new ServerResponse(true, await getTimeInStatus(filters)));
    } catch (error) {
      if (error instanceof FlowError) return res.status(error.status).send(new ServerResponse(false, null, error.message));
      throw error;
    }
  }
}
