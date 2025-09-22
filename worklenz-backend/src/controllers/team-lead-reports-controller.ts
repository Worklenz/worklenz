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
      if (teamLead.role_name !== 'Team Lead' && teamLead.role_name !== 'Member') {
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
      console.error('Error fetching team members:', error);
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
      if (teamLead.role_name !== 'Team Lead' && teamLead.role_name !== 'Member') {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Team Leads can access this endpoint"));
      }

      // Build date filter
      let dateFilter = '';
      const queryParams = [teamLead.team_member_id];
      
      if (startDate && endDate) {
        dateFilter = 'AND DATE(tltl.logged_at) BETWEEN $2::DATE AND $3::DATE';
        queryParams.push(startDate as string, endDate as string);
      }

      // Get time logs summary using the view
      const timeLogsSummaryQuery = `
        SELECT 
          tltl.managed_member_id,
          tltl.managed_member_name,
          tltl.managed_member_user_id,
          COUNT(tltl.time_log_id) as total_logs,
          SUM(tltl.time_spent) as total_time_minutes,
          COUNT(DISTINCT tltl.project_id) as projects_worked_on,
          COUNT(DISTINCT DATE(tltl.logged_at)) as days_logged,
          MAX(tltl.logged_at) as last_log_date
        FROM team_lead_time_logs tltl
        WHERE tltl.team_lead_id = $1::UUID
        ${dateFilter}
        GROUP BY 
          tltl.managed_member_id,
          tltl.managed_member_name,
          tltl.managed_member_user_id
        ORDER BY total_time_minutes DESC
      `;

      const result = await db.query(timeLogsSummaryQuery, queryParams);

      return res.send(new ServerResponse(true, result.rows));

    } catch (error) {
      console.error('Error fetching team time logs summary:', error);
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
      if (teamLead.role_name !== 'Team Lead' && teamLead.role_name !== 'Member') {
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
      let dateFilter = '';
      const queryParams = [teamLead.team_member_id, memberId];
      
      if (startDate && endDate) {
        dateFilter = 'AND DATE(tltl.logged_at) BETWEEN $3::DATE AND $4::DATE';
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
        WHERE tltl.team_lead_id = $1::UUID 
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
        WHERE tltl.team_lead_id = $1::UUID 
        AND tltl.managed_member_id = $2::UUID
        ${dateFilter}
      `;

      const countParams = queryParams.slice(0, dateFilter ? 4 : 2);
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || '0');

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
      console.error('Error fetching member detailed time logs:', error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }

  public static async getTeamPerformanceStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
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
      if (teamLead.role_name !== 'Team Lead' && teamLead.role_name !== 'Member') {
        return res.status(403).send(new ServerResponse(false, null, "Access denied: Only Team Leads can access this endpoint"));
      }

      // Get performance stats using the view
      const performanceQuery = `
        SELECT 
          managed_member_id,
          managed_member_name,
          managed_member_email,
          managed_member_role_name,
          hierarchy_level,
          assigned_tasks,
          completed_tasks,
          completion_percentage,
          total_time_minutes,
          overdue_tasks,
          active_projects,
          last_time_log
        FROM team_lead_member_performance
        WHERE team_lead_id = $1::UUID
        ORDER BY total_time_minutes DESC
      `;

      const result = await db.query(performanceQuery, [teamLead.team_member_id]);

      return res.send(new ServerResponse(true, result.rows));

    } catch (error) {
      console.error('Error fetching team performance stats:', error);
      return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
    }
  }
}
