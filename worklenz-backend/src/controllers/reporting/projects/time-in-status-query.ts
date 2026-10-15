import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import {
  FLOW_SCOPES,
  FlowFilters,
  TIME_IN_STATUS_GROUP_BYS,
  TimeInStatusGroupBy,
  TimeInStatusTaskQuery,
} from "../../../services/reporting-flow.service";
import { isValidUuid } from "../../../shared/validation-helpers";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Undefined when absent, null when present but not YYYY-MM-DD. */
const parseIsoDate = (value: unknown): string | undefined | null => {
  if (value === undefined || value === "") return undefined;
  return typeof value === "string" && DATE_ONLY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null;
};

const parseList = (value: unknown): string[] =>
  typeof value === "string"
    ? value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
    : [];

export interface TimeInStatusRequest {
  filters: FlowFilters;
  query: TimeInStatusTaskQuery;
  groupBy: TimeInStatusGroupBy;
}

/** Parses the flow query string (chart, task list, groups and export); returns an error message on bad input. */
export function parseTimeInStatusRequest(req: IWorkLenzRequest): TimeInStatusRequest | string {
  const scope = (req.query.scope as string) || "team";
  const projectId = req.query.projectId as string | undefined;
  const projectIds = parseList(req.query.projectIds);
  const assigneeIds = parseList(req.query.assigneeIds);
  const dateFrom = parseIsoDate(req.query.dateFrom);
  const dateTo = parseIsoDate(req.query.dateTo);
  const groupBy = ((req.query.group_by as string) || "project") as TimeInStatusGroupBy;

  if (!(FLOW_SCOPES as readonly string[]).includes(scope)) return "Invalid scope";
  if (dateFrom === null || dateTo === null) return "Dates must be YYYY-MM-DD";
  if ((projectId && !isValidUuid(projectId)) || [...projectIds, ...assigneeIds].some(id => !isValidUuid(id))) return "Invalid id";
  if (!(TIME_IN_STATUS_GROUP_BYS as readonly string[]).includes(groupBy)) return "Invalid group_by";

  const index = Number(req.query.index);
  const size = Number(req.query.size);
  return {
    filters: {
      teamId: req.user?.team_id as string,
      userId: req.user?.id as string,
      scope: scope as FlowFilters["scope"],
      projectId,
      projectIds: projectIds.length ? projectIds : undefined,
      includeSubtasks: req.query.includeSubtasks === "true",
      includeArchived: req.query.archived === "true",
      assigneeIds: assigneeIds.length ? assigneeIds : undefined,
      dateFrom,
      dateTo,
    },
    query: {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      statusNames: parseList(req.query.statuses),
      sortField: req.query.field as string | undefined,
      sortOrder: req.query.order as string | undefined,
      index: Number.isFinite(index) && index > 0 ? index : 1,
      size: Number.isFinite(size) && size > 0 ? size : 10,
    },
    groupBy,
  };
}
