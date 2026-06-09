import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";

// Shared helper: resolve the team_member_id for the current user and verify they
// have a role that is allowed to use team-lead reports.
// Returns null and sends the appropriate error response when access is denied.
async function resolveTeamLeadMemberId(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse
): Promise<string | null> {
  const userId = req.user?.id;
  const teamId = req.user?.team_id;

  if (!userId || !teamId) {
    res.status(400).send(new ServerResponse(false, null, "User context is required"));
    return null;
  }

  const result = await db.query(
    `SELECT tm.id AS team_member_id, r.name AS role_name
     FROM team_members tm
     JOIN roles r ON tm.role_id = r.id
     WHERE tm.user_id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
     LIMIT 1`,
    [userId, teamId]
  );

  if (result.rows.length === 0) {
    res.status(404).send(new ServerResponse(false, null, "Team member not found"));
    return null;
  }

  const { team_member_id, role_name } = result.rows[0];

  // TODO: tighten to 'Team Lead' only once role assignment is stable
  if (role_name !== "Team Lead" && role_name !== "Member") {
    res.status(403).send(new ServerResponse(false, null, "Access denied: Only Team Leads can access this endpoint"));
    return null;
  }

  return team_member_id;
}

export default class TeamLeadReportsController {

  public static async getMyTeamMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const teamMemberId = await resolveTeamLeadMemberId(req, res);
      if (!teamMemberId) return res;

      const result = await db.query(
        `SELECT
           managed_member_id,
           managed_member_user_id,
           managed_member_name,
           managed_member_email,
           managed_member_role_name,
           level AS hierarchy_level
         FROM team_lead_managed_members
         WHERE manager_id = $1::UUID
         ORDER BY level, managed_member_name`,
        [teamMemberId]
      );

      return res.send(new ServerResponse(true, result.rows));
    } catch (error) {
      console.error("Error fetching team members:", error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async getTeamTimeLogsSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const teamId = req.user?.team_id;
      const teamMemberId = await resolveTeamLeadMemberId(req, res);
      if (!teamMemberId) return res;

      const { startDate, endDate } = req.query;

      // Build date filter — use a half-open range on the raw timestamp so the
      // composite index (user_id, created_at) can be used without a cast.
      let dateFilter = "";
      const queryParams: (string | undefined)[] = [teamMemberId];

      if (startDate && endDate) {
        dateFilter = "AND twl.created_at >= $2::DATE AND twl.created_at < ($3::DATE + INTERVAL '1 day')";
        queryParams.push(startDate as string, endDate as string);
      }

      // Run the aggregation and the working-settings lookup in parallel.
      // Working days are counted inside SQL to avoid a JS loop over the date range.
      const summaryQuery = `
        WITH managed AS (
          SELECT DISTINCT managed_member_id, managed_member_user_id, managed_member_name
          FROM team_lead_managed_members
          WHERE manager_id = $1::UUID
        )
        SELECT
          m.managed_member_id,
          m.managed_member_name,
          m.managed_member_user_id,
          COUNT(twl.id)                        AS total_logs,
          COALESCE(SUM(twl.time_spent), 0)     AS total_time_minutes,
          COUNT(DISTINCT t.project_id)         AS projects_worked_on,
          COUNT(DISTINCT twl.created_at::date) AS days_logged,
          MAX(twl.created_at)                  AS last_log_date
        FROM managed m
        JOIN task_work_log twl ON twl.user_id = m.managed_member_user_id
        JOIN tasks t ON twl.task_id = t.id AND t.archived = FALSE
        WHERE TRUE
        ${dateFilter}
        GROUP BY m.managed_member_id, m.managed_member_name, m.managed_member_user_id
        ORDER BY total_time_minutes DESC`;

      // Count working days entirely in SQL — avoids a JS loop and a second round-trip.
      // Falls back to 0 when no date range is provided.
      const workingDaysQuery = startDate && endDate
        ? `SELECT
             COALESCE(o.working_hours, 8)                                    AS hours_per_day,
             COUNT(*)                                                         AS working_days
           FROM generate_series($1::DATE, $2::DATE, '1 day'::INTERVAL) AS d(day)
           JOIN teams t ON t.id = $3::UUID
           JOIN organizations o ON o.id = t.organization_id
           JOIN organization_working_days owd ON owd.organization_id = o.id
           WHERE
             (EXTRACT(DOW FROM d.day) = 1 AND owd.monday)    OR
             (EXTRACT(DOW FROM d.day) = 2 AND owd.tuesday)   OR
             (EXTRACT(DOW FROM d.day) = 3 AND owd.wednesday) OR
             (EXTRACT(DOW FROM d.day) = 4 AND owd.thursday)  OR
             (EXTRACT(DOW FROM d.day) = 5 AND owd.friday)    OR
             (EXTRACT(DOW FROM d.day) = 6 AND owd.saturday)  OR
             (EXTRACT(DOW FROM d.day) = 0 AND owd.sunday)
           GROUP BY o.working_hours`
        : null;

      // Fire both queries concurrently
      const [summaryResult, workingSettingsResult] = await Promise.all([
        db.query(summaryQuery, queryParams),
        workingDaysQuery
          ? db.query(workingDaysQuery, [startDate, endDate, teamId])
          : Promise.resolve({ rows: [] }),
      ]);

      const totalTimeLogged = summaryResult.rows.reduce(
        (sum, member) => sum + parseFloat(member.total_time_minutes || "0"),
        0
      );

      const workingDays = parseInt(workingSettingsResult.rows[0]?.working_days || "0");
      const hoursPerDay = parseFloat(workingSettingsResult.rows[0]?.hours_per_day || "8");

      const teamMemberCount = summaryResult.rows.length > 0 ? summaryResult.rows.length : 1;
      const totalExpectedHours = workingDays * hoursPerDay * teamMemberCount;

      const totalUtilization = totalExpectedHours > 0
        ? ((totalTimeLogged / 3600) / totalExpectedHours * 100).toFixed(1)
        : "0";

      return res.send(new ServerResponse(true, {
        filteredRows: summaryResult.rows,
        totals: {
          total_time_logs: (totalTimeLogged / 3600).toFixed(1),
          total_estimated_hours: totalExpectedHours.toFixed(1),
          total_utilization: totalUtilization,
        },
      }));
    } catch (error) {
      console.error("Error fetching team time logs summary:", error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async getMemberDetailedTimeLogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const teamMemberId = await resolveTeamLeadMemberId(req, res);
      if (!teamMemberId) return res;

      const { memberId } = req.params;
      if (!memberId) {
        return res.status(400).send(new ServerResponse(false, null, "Required parameters missing"));
      }

      const { startDate, endDate, page = 1, limit = 50 } = req.query;

      let dateFilter = "";
      const baseParams: string[] = [teamMemberId, memberId];

      if (startDate && endDate) {
        dateFilter = "AND tltl.logged_at >= $3::DATE AND tltl.logged_at < ($4::DATE + INTERVAL '1 day')";
        baseParams.push(startDate as string, endDate as string);
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Fold the access check into the main query as a guard CTE.
      // If the member does not report to this team lead the access_ok CTE returns
      // no rows and both the data query and the count return empty / zero — saving
      // a separate round-trip for the access check.
      const dataQuery = `
        WITH access_ok AS (
          SELECT 1
          FROM team_lead_managed_members
          WHERE manager_id = $1::UUID AND managed_member_id = $2::UUID
          LIMIT 1
        )
        SELECT
          tltl.time_log_id,
          tltl.time_spent,
          tltl.description,
          tltl.logged_by_timer,
          tltl.logged_at,
          tltl.task_id,
          tltl.task_name,
          tltl.project_id,
          tltl.project_name,
          tltl.managed_member_name
        FROM team_lead_time_logs tltl
        WHERE EXISTS (SELECT 1 FROM access_ok)
          AND tltl.manager_id = $1::UUID
          AND tltl.managed_member_id = $2::UUID
          ${dateFilter}
        ORDER BY tltl.logged_at DESC
        LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`;

      const countQuery = `
        WITH access_ok AS (
          SELECT 1
          FROM team_lead_managed_members
          WHERE manager_id = $1::UUID AND managed_member_id = $2::UUID
          LIMIT 1
        )
        SELECT COUNT(*) AS total
        FROM team_lead_time_logs tltl
        WHERE EXISTS (SELECT 1 FROM access_ok)
          AND tltl.manager_id = $1::UUID
          AND tltl.managed_member_id = $2::UUID
          ${dateFilter}`;

      const dataParams = [...baseParams, limitNum.toString(), offset.toString()];

      // Run data and count queries in parallel
      const [dataResult, countResult] = await Promise.all([
        db.query(dataQuery, dataParams),
        db.query(countQuery, baseParams),
      ]);

      // If access was denied the guard CTE returns nothing — surface a 403
      if (dataResult.rows.length === 0 && parseInt(countResult.rows[0]?.total || "0") === 0) {
        // Distinguish "no data" from "no access" by checking the hierarchy directly
        const accessCheck = await db.query(
          `SELECT 1 FROM team_lead_managed_members
           WHERE manager_id = $1::UUID AND managed_member_id = $2::UUID LIMIT 1`,
          [teamMemberId, memberId]
        );
        if (accessCheck.rows.length === 0) {
          return res.status(403).send(new ServerResponse(false, null, "Access denied: Member does not report to you"));
        }
      }

      const total = parseInt(countResult.rows[0]?.total || "0");

      return res.send(new ServerResponse(true, {
        logs: dataResult.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      }));
    } catch (error) {
      console.error("Error fetching member detailed time logs:", error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async getTeamPerformanceStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const teamMemberId = await resolveTeamLeadMemberId(req, res);
      if (!teamMemberId) return res;

      const { startDate, endDate } = req.query;

      let timeLogDateFilter = "";
      const queryParams: (string | undefined)[] = [teamMemberId];

      if (startDate && endDate) {
        timeLogDateFilter = "AND twl.created_at >= $2::DATE AND twl.created_at < ($3::DATE + INTERVAL '1 day')";
        queryParams.push(startDate as string, endDate as string);
      }

      // Single pass over the hierarchy view — task stats and time-log stats are
      // computed in separate lateral aggregations so the recursive CTE is only
      // expanded once.  Task stats are intentionally not date-filtered (they
      // reflect overall workload); only time logs respect the date range.
      const performanceQuery = `
        WITH managed AS (
          SELECT DISTINCT
            managed_member_id,
            managed_member_user_id,
            managed_member_name,
            managed_member_email,
            managed_member_role_name,
            level AS hierarchy_level
          FROM team_lead_managed_members
          WHERE manager_id = $1::UUID
        ),
        task_agg AS (
          SELECT
            m.managed_member_id,
            COUNT(DISTINCT ta.task_id)                                                                    AS assigned_tasks,
            COUNT(DISTINCT CASE WHEN ts.name = 'Done' THEN ta.task_id END)                               AS completed_tasks,
            COUNT(DISTINCT CASE WHEN t.end_date < NOW() AND ts.name != 'Done' THEN ta.task_id END)       AS overdue_tasks
          FROM managed m
          LEFT JOIN tasks_assignees ta ON ta.team_member_id = m.managed_member_id
          LEFT JOIN tasks t ON t.id = ta.task_id AND t.archived = FALSE
          LEFT JOIN task_statuses ts ON t.status_id = ts.id
          GROUP BY m.managed_member_id
        ),
        time_log_agg AS (
          SELECT
            m.managed_member_id,
            COALESCE(SUM(twl.time_spent), 0)     AS total_time_minutes,
            COUNT(DISTINCT t.project_id)         AS active_projects,
            MAX(twl.created_at)                  AS last_time_log
          FROM managed m
          JOIN task_work_log twl ON twl.user_id = m.managed_member_user_id
          JOIN tasks t ON twl.task_id = t.id AND t.archived = FALSE
          WHERE TRUE
          ${timeLogDateFilter}
          GROUP BY m.managed_member_id
        )
        SELECT
          m.managed_member_id,
          m.managed_member_name,
          m.managed_member_user_id,
          m.managed_member_email,
          m.managed_member_role_name,
          m.hierarchy_level,
          COALESCE(ta.assigned_tasks, 0)   AS assigned_tasks,
          COALESCE(ta.completed_tasks, 0)  AS completed_tasks,
          CASE
            WHEN COALESCE(ta.assigned_tasks, 0) > 0
            THEN ROUND((COALESCE(ta.completed_tasks, 0) * 100.0) / ta.assigned_tasks, 2)
            ELSE 0
          END                              AS completion_percentage,
          COALESCE(tl.total_time_minutes, 0) AS total_time_minutes,
          COALESCE(ta.overdue_tasks, 0)    AS overdue_tasks,
          COALESCE(tl.active_projects, 0)  AS active_projects,
          tl.last_time_log
        FROM managed m
        LEFT JOIN task_agg ta ON ta.managed_member_id = m.managed_member_id
        LEFT JOIN time_log_agg tl ON tl.managed_member_id = m.managed_member_id
        ORDER BY total_time_minutes DESC`;

      const result = await db.query(performanceQuery, queryParams);

      return res.send(new ServerResponse(true, result.rows));
    } catch (error) {
      console.error("Error fetching team performance stats:", error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }
}
