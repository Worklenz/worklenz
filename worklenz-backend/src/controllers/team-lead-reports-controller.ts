import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";

export default class TeamLeadReportsController {
  
  public static async getMyTeamMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const userId = req.user?.id;
      const teamId = req.user?.team_id;

      if (!userId || !teamId) {
        return res.status(400).send(new ServerResponse(false, null, "User context is required"));
      }

      // Get the team lead's member ID
      const teamLeadQuery = `
        SELECT tm.id as team_member_id, r.name as role_name
        FROM team_members tm
        JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const teamLeadResult = await db.query(teamLeadQuery, [userId, teamId]);
      
      if (teamLeadResult.rows.length === 0) {
        return res.status(404).send(new ServerResponse(false, null, "Team member not found"));
      }

      const teamLead = teamLeadResult.rows[0];
      
      // TODO: Implement proper Team Lead role checking
      // For now, allow access to non-admin users as a temporary fix
      if (teamLead.role_name !== "Team Lead" && teamLead.role_name !== "Member") {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Team Leads can access this endpoint"));
      }

      // Get managed members using the view
      const managedMembersQuery = `
        SELECT 
          managed_member_id,
          managed_member_user_id,
          managed_member_name,
          managed_member_email,
          managed_member_role_name,
          level as hierarchy_level
        FROM team_lead_managed_members
        WHERE manager_id = $1::UUID
        ORDER BY level, managed_member_name
      `;

      const result = await db.query(managedMembersQuery, [teamLead.team_member_id]);

      return res.send(new ServerResponse(true, result.rows));

    } catch (error) {
      console.error("Error fetching team members:", error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async getTeamTimeLogsSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const userId = req.user?.id;
      const teamId = req.user?.team_id;
      const { startDate, endDate } = req.query;

      if (!userId || !teamId) {
        return res.status(400).send(new ServerResponse(false, null, "User context is required"));
      }

      // Get the team lead's member ID
      const teamLeadQuery = `
        SELECT tm.id as team_member_id, r.name as role_name
        FROM team_members tm
        JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const teamLeadResult = await db.query(teamLeadQuery, [userId, teamId]);
      
      if (teamLeadResult.rows.length === 0) {
        return res.status(404).send(new ServerResponse(false, null, "Team member not found"));
      }

      const teamLead = teamLeadResult.rows[0];
      
      // TODO: Implement proper Team Lead role checking
      // For now, allow access to non-admin users as a temporary fix
      if (teamLead.role_name !== "Team Lead" && teamLead.role_name !== "Member") {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Team Leads can access this endpoint"));
      }

      // Build date filter using range on raw timestamp to allow index usage
      let dateFilter = "";
      const queryParams: string[] = [teamLead.team_member_id];

      if (startDate && endDate) {
        dateFilter = "AND twl.created_at >= $2::DATE AND twl.created_at < ($3::DATE + INTERVAL '1 day')";
        queryParams.push(startDate as string, endDate as string);
      }

      // Scope the recursive CTE to this manager first, then join work logs directly
      // to avoid scanning all work logs across all managed members of all managers.
      const timeLogsSummaryQuery = `
        WITH managed AS (
          SELECT DISTINCT managed_member_id, managed_member_user_id, managed_member_name
          FROM team_lead_managed_members
          WHERE manager_id = $1::UUID
        )
        SELECT
          m.managed_member_id,
          m.managed_member_name,
          m.managed_member_user_id,
          COUNT(twl.id) AS total_logs,
          SUM(twl.time_spent) AS total_time_minutes,
          COUNT(DISTINCT t.project_id) AS projects_worked_on,
          COUNT(DISTINCT twl.created_at::date) AS days_logged,
          MAX(twl.created_at) AS last_log_date
        FROM managed m
        JOIN task_work_log twl ON twl.user_id = m.managed_member_user_id
        JOIN tasks t ON twl.task_id = t.id AND t.archived = FALSE
        WHERE TRUE
        ${dateFilter}
        GROUP BY m.managed_member_id, m.managed_member_name, m.managed_member_user_id
        ORDER BY total_time_minutes DESC
      `;

      const result = await db.query(timeLogsSummaryQuery, queryParams);

      // Calculate totals similar to members time report
      const totalTimeLogged = result.rows.reduce((sum, member) => sum + parseFloat(member.total_time_minutes || "0"), 0);
      
      // Get organization working settings to calculate expected capacity
      const workingSettingsQuery = `
        SELECT 
          monday, tuesday, wednesday, thursday, friday, saturday, sunday,
          (SELECT hours_per_day FROM organizations WHERE id = t.organization_id) as hours_per_day
        FROM organization_working_days owd
        JOIN teams t ON t.organization_id = owd.organization_id
        WHERE t.id = $1::UUID
        LIMIT 1
      `;
      
      const workingSettingsResult = await db.query(workingSettingsQuery, [teamId]);
      const workingDaysConfig = workingSettingsResult.rows[0] || {
        monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false,
        hours_per_day: 8
      };
      
      // Calculate working days in the date range (excluding weekends based on org settings)
      let workingDays = 0;
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        // Set time to midnight to avoid timezone issues
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        const current = new Date(start);
        
        // Include end date by using <= comparison
        while (current <= end) {
          const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const isWorkingDay = (
            (dayOfWeek === 1 && workingDaysConfig.monday) ||
            (dayOfWeek === 2 && workingDaysConfig.tuesday) ||
            (dayOfWeek === 3 && workingDaysConfig.wednesday) ||
            (dayOfWeek === 4 && workingDaysConfig.thursday) ||
            (dayOfWeek === 5 && workingDaysConfig.friday) ||
            (dayOfWeek === 6 && workingDaysConfig.saturday) ||
            (dayOfWeek === 0 && workingDaysConfig.sunday)
          );
          
          if (isWorkingDay) {
            workingDays++;
          }
          
          current.setDate(current.getDate() + 1);
        }
      }
      
      const hoursPerDay = workingDaysConfig.hours_per_day || 8;
      
      // Calculate expected hours based on team members with activity
      // If no team members have logged time, still show expected capacity for potential team size
      const teamMemberCount = result.rows.length > 0 ? result.rows.length : 1;
      const totalExpectedHours = workingDays * hoursPerDay * teamMemberCount;
      
      const totalUtilization = totalExpectedHours > 0 
        ? ((totalTimeLogged / 3600) / totalExpectedHours * 100).toFixed(1)
        : "0";

      const response = {
        filteredRows: result.rows,
        totals: {
          total_time_logs: (totalTimeLogged / 3600).toFixed(1),
          total_estimated_hours: totalExpectedHours.toFixed(1),
          total_utilization: totalUtilization
        }
      };

      return res.send(new ServerResponse(true, response));

    } catch (error) {
      console.error("Error fetching team time logs summary:", error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async getMemberDetailedTimeLogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const userId = req.user?.id;
      const teamId = req.user?.team_id;
      const { memberId } = req.params;
      const { startDate, endDate, page = 1, limit = 50 } = req.query;

      if (!userId || !teamId || !memberId) {
        return res.status(400).send(new ServerResponse(false, null, "Required parameters missing"));
      }

      // Get the team lead's member ID and verify access
      const teamLeadQuery = `
        SELECT tm.id as team_member_id, r.name as role_name
        FROM team_members tm
        JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const teamLeadResult = await db.query(teamLeadQuery, [userId, teamId]);
      
      if (teamLeadResult.rows.length === 0) {
        return res.status(404).send(new ServerResponse(false, null, "Team member not found"));
      }

      const teamLead = teamLeadResult.rows[0];
      
      // TODO: Implement proper Team Lead role checking
      // For now, allow access to non-admin users as a temporary fix
      if (teamLead.role_name !== "Team Lead" && teamLead.role_name !== "Member") {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Team Leads can access this endpoint"));
      }

      // Verify the member reports to this team lead
      const accessCheckQuery = `
        SELECT 1 FROM team_lead_managed_members
        WHERE manager_id = $1::UUID AND managed_member_id = $2::UUID
      `;
      
      const accessResult = await db.query(accessCheckQuery, [teamLead.team_member_id, memberId]);
      
      if (accessResult.rows.length === 0) {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Member does not report to you"));
      }

      // Build date filter and pagination
      let dateFilter = "";
      const queryParams = [teamLead.team_member_id, memberId];
      
      if (startDate && endDate) {
        dateFilter = "AND DATE(tltl.logged_at) BETWEEN $3::DATE AND $4::DATE";
        queryParams.push(startDate as string, endDate as string);
      }

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const paginationClause = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit as string, offset.toString());

      // Get detailed time logs
      const detailedLogsQuery = `
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
        WHERE tltl.manager_id = $1::UUID 
        AND tltl.managed_member_id = $2::UUID
        ${dateFilter}
        ORDER BY tltl.logged_at DESC
        ${paginationClause}
      `;

      const result = await db.query(detailedLogsQuery, queryParams);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM team_lead_time_logs tltl
        WHERE tltl.manager_id = $1::UUID 
        AND tltl.managed_member_id = $2::UUID
        ${dateFilter}
      `;

      const countParams = queryParams.slice(0, dateFilter ? 4 : 2);
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      return res.send(new ServerResponse(true, {
        logs: result.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      }));

    } catch (error) {
      console.error("Error fetching member detailed time logs:", error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async getTeamPerformanceStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const userId = req.user?.id;
      const teamId = req.user?.team_id;
      const { startDate, endDate } = req.query;

      if (!userId || !teamId) {
        return res.status(400).send(new ServerResponse(false, null, "User context is required"));
      }

      // Get the team lead's member ID
      const teamLeadQuery = `
        SELECT tm.id as team_member_id, r.name as role_name
        FROM team_members tm
        JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = $1::UUID AND tm.team_id = $2::UUID AND tm.active = TRUE
      `;
      
      const teamLeadResult = await db.query(teamLeadQuery, [userId, teamId]);
      
      if (teamLeadResult.rows.length === 0) {
        return res.status(404).send(new ServerResponse(false, null, "Team member not found"));
      }

      const teamLead = teamLeadResult.rows[0];
      
      // TODO: Implement proper Team Lead role checking
      // For now, allow access to non-admin users as a temporary fix
      if (teamLead.role_name !== "Team Lead" && teamLead.role_name !== "Member") {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Team Leads can access this endpoint"));
      }

      // Build date filter using range on raw timestamp to allow index usage
      let timeLogDateFilter = "";
      const queryParams: string[] = [teamLead.team_member_id];

      if (startDate && endDate) {
        timeLogDateFilter = "AND twl.created_at >= $2::DATE AND twl.created_at < ($3::DATE + INTERVAL '1 day')";
        queryParams.push(startDate as string, endDate as string);
      }

      // Scope the recursive CTE to this manager first.
      // Task stats (assigned/completed/overdue) are intentionally not date-filtered — they
      // reflect the member's overall workload. Only time logs are date-filtered.
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
        time_log_agg AS (
          SELECT
            m.managed_member_id,
            COALESCE(SUM(twl.time_spent), 0) AS total_time_minutes,
            COUNT(DISTINCT t.project_id) AS active_projects,
            MAX(twl.created_at) AS last_time_log
          FROM managed m
          JOIN task_work_log twl ON twl.user_id = m.managed_member_user_id
          JOIN tasks t ON twl.task_id = t.id AND t.archived = FALSE
          WHERE TRUE
          ${timeLogDateFilter}
          GROUP BY m.managed_member_id
        ),
        task_agg AS (
          SELECT
            m.managed_member_id,
            COUNT(DISTINCT ta.task_id) AS assigned_tasks,
            COUNT(DISTINCT CASE WHEN ts.name = 'Done' THEN ta.task_id END) AS completed_tasks,
            COUNT(DISTINCT CASE WHEN t.end_date < NOW() AND ts.name != 'Done' THEN ta.task_id END) AS overdue_tasks
          FROM managed m
          LEFT JOIN tasks_assignees ta ON ta.team_member_id = m.managed_member_id
          LEFT JOIN tasks t ON t.id = ta.task_id AND t.archived = FALSE
          LEFT JOIN task_statuses ts ON t.status_id = ts.id
          GROUP BY m.managed_member_id
        )
        SELECT
          m.managed_member_id,
          m.managed_member_name,
          m.managed_member_user_id,
          m.managed_member_email,
          m.managed_member_role_name,
          m.hierarchy_level,
          COALESCE(ta.assigned_tasks, 0) AS assigned_tasks,
          COALESCE(ta.completed_tasks, 0) AS completed_tasks,
          CASE
            WHEN COALESCE(ta.assigned_tasks, 0) > 0
            THEN ROUND((COALESCE(ta.completed_tasks, 0) * 100.0) / ta.assigned_tasks, 2)
            ELSE 0
          END AS completion_percentage,
          COALESCE(tl.total_time_minutes, 0) AS total_time_minutes,
          COALESCE(ta.overdue_tasks, 0) AS overdue_tasks,
          COALESCE(tl.active_projects, 0) AS active_projects,
          tl.last_time_log
        FROM managed m
        LEFT JOIN task_agg ta ON ta.managed_member_id = m.managed_member_id
        LEFT JOIN time_log_agg tl ON tl.managed_member_id = m.managed_member_id
        ORDER BY total_time_minutes DESC
      `;

      const result = await db.query(performanceQuery, queryParams);

      return res.send(new ServerResponse(true, result.rows));

    } catch (error) {
      console.error("Error fetching team performance stats:", error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }
}
