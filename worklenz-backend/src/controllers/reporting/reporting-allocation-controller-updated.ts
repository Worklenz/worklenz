// Example of updated getMemberTimeSheets method with timezone support
// This shows the key changes needed to handle timezones properly

import moment from "moment-timezone";
import db from "../../config/db";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { DATE_RANGES } from "../../shared/constants";

export async function getMemberTimeSheets(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
  const archived = req.query.archived === "true";
  const teams = (req.body.teams || []) as string[];
  const teamIds = teams.map(id => `'${id}'`).join(",");
  const projects = (req.body.projects || []) as string[];
  const projectIds = projects.map(p => `'${p}'`).join(",");
  const {billable} = req.body;
  
  // Get user timezone from request or database
  const userTimezone = req.body.timezone || await getUserTimezone(req.user?.id || "");
  
  if (!teamIds || !projectIds.length)
    return res.status(200).send(new ServerResponse(true, { users: [], projects: [] }));
    
  const { duration, date_range } = req.body;
  
  // Calculate date range with timezone support
  let startDate: moment.Moment;
  let endDate: moment.Moment;
  
  if (date_range && date_range.length === 2) {
    // Convert user's local dates to their timezone's start/end of day
    startDate = moment.tz(date_range[0], userTimezone).startOf("day");
    endDate = moment.tz(date_range[1], userTimezone).endOf("day");
  } else if (duration === DATE_RANGES.ALL_TIME) {
    const minDateQuery = `SELECT MIN(COALESCE(start_date, created_at)) as min_date FROM projects WHERE id IN (${projectIds})`;
    const minDateResult = await db.query(minDateQuery, []);
    const minDate = minDateResult.rows[0]?.min_date;
    startDate = minDate ? moment.tz(minDate, userTimezone) : moment.tz("2000-01-01", userTimezone);
    endDate = moment.tz(userTimezone);
  } else {
    // Calculate ranges based on user's timezone
    const now = moment.tz(userTimezone);
    
    switch (duration) {
      case DATE_RANGES.YESTERDAY:
        startDate = now.clone().subtract(1, "day").startOf("day");
        endDate = now.clone().subtract(1, "day").endOf("day");
        break;
      case DATE_RANGES.LAST_WEEK:
        startDate = now.clone().subtract(1, "week").startOf("isoWeek");
        endDate = now.clone().subtract(1, "week").endOf("isoWeek");
        break;
      case DATE_RANGES.LAST_MONTH:
        startDate = now.clone().subtract(1, "month").startOf("month");
        endDate = now.clone().subtract(1, "month").endOf("month");
        break;
      case DATE_RANGES.LAST_QUARTER:
        startDate = now.clone().subtract(3, "months").startOf("day");
        endDate = now.clone().endOf("day");
        break;
      default:
        startDate = now.clone().startOf("day");
        endDate = now.clone().endOf("day");
    }
  }
  
  // Convert to UTC for database queries
  const startUtc = startDate.utc().format("YYYY-MM-DD HH:mm:ss");
  const endUtc = endDate.utc().format("YYYY-MM-DD HH:mm:ss");
  
  // Calculate working days in user's timezone
  const totalDays = endDate.diff(startDate, "days") + 1;
  let workingDays = 0;
  
  const current = startDate.clone();
  while (current.isSameOrBefore(endDate, "day")) {
    if (current.isoWeekday() >= 1 && current.isoWeekday() <= 5) {
      workingDays++;
    }
    current.add(1, "day");
  }
  
  // Updated SQL query with proper timezone handling
  const billableQuery = buildBillableQuery(billable);
  const archivedClause = archived ? "" : `AND projects.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = projects.id AND user_id = '${req.user?.id}')`;
  
  const q = `
    WITH project_hours AS (
      SELECT 
        id,
        COALESCE(hours_per_day, 8) as hours_per_day
      FROM projects
      WHERE id IN (${projectIds})
    ),
    total_working_hours AS (
      SELECT 
        SUM(hours_per_day) * ${workingDays} as total_hours
      FROM project_hours
    )
    SELECT 
      u.id,
      u.email,
      tm.name,
      tm.color_code,
      COALESCE(SUM(twl.time_spent), 0) as logged_time,
      COALESCE(SUM(twl.time_spent), 0) / 3600.0 as value,
      (SELECT total_hours FROM total_working_hours) as total_working_hours,
      CASE 
        WHEN (SELECT total_hours FROM total_working_hours) > 0 
        THEN ROUND((COALESCE(SUM(twl.time_spent), 0) / 3600.0) / (SELECT total_hours FROM total_working_hours) * 100, 2)
        ELSE 0 
      END as utilization_percent,
      ROUND(COALESCE(SUM(twl.time_spent), 0) / 3600.0, 2) as utilized_hours,
      ROUND(COALESCE(SUM(twl.time_spent), 0) / 3600.0 - (SELECT total_hours FROM total_working_hours), 2) as over_under_utilized_hours,
      '${userTimezone}' as user_timezone,
      '${startDate.format("YYYY-MM-DD")}' as report_start_date,
      '${endDate.format("YYYY-MM-DD")}' as report_end_date
    FROM team_members tm
      LEFT JOIN users u ON tm.user_id = u.id
      LEFT JOIN task_work_log twl ON twl.user_id = u.id
      LEFT JOIN tasks t ON twl.task_id = t.id ${billableQuery}
      LEFT JOIN projects p ON t.project_id = p.id
    WHERE tm.team_id IN (${teamIds})
      AND (
        twl.id IS NULL 
        OR (
          p.id IN (${projectIds})
          AND twl.created_at >= '${startUtc}'::TIMESTAMP 
          AND twl.created_at <= '${endUtc}'::TIMESTAMP
          ${archivedClause}
        )
      )
    GROUP BY u.id, u.email, tm.name, tm.color_code
    ORDER BY logged_time DESC`;
    
  const result = await db.query(q, []);
  
  // Add timezone context to response
  const response = {
    data: result.rows,
    timezone_info: {
      user_timezone: userTimezone,
      report_period: {
        start: startDate.format("YYYY-MM-DD HH:mm:ss z"),
        end: endDate.format("YYYY-MM-DD HH:mm:ss z"),
        working_days: workingDays,
        total_days: totalDays
      }
    }
  };
  
  return res.status(200).send(new ServerResponse(true, response));
}

async function getUserTimezone(userId: string): Promise<string> {
  const q = `SELECT tz.name as timezone 
             FROM users u 
             JOIN timezones tz ON u.timezone_id = tz.id 
             WHERE u.id = $1`;
  const result = await db.query(q, [userId]);
  return result.rows[0]?.timezone || "UTC";
}

function buildBillableQuery(billable: { billable: boolean; nonBillable: boolean }): string {
  if (!billable) return "";
  
  const { billable: isBillable, nonBillable } = billable;
  
  if (isBillable && nonBillable) {
    return "";
  } else if (isBillable) {
    return " AND tasks.billable IS TRUE";
  } else if (nonBillable) {
    return " AND tasks.billable IS FALSE";
  }
  
  return "";
}