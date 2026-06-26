import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

interface IActiveTeamOwner {
  owner_email: string;
  owner_name: string;
  activity_score: number;
  recent_activities: number;
  active_days_last_30: number;
  total_projects: number;
  active_projects: number;
  total_team_members: number;
  active_team_members: number;
  total_tasks: number;
  recent_task_activities: number;
  recent_time_logs: number;
  last_activity_date: string;
  days_since_last_activity: number;
  activity_level: string;
  team_created_at: string;
}

export default class AdminActiveTeamOwnersController extends WorklenzControllerBase {
  
  @HandleExceptions()
  public static async getMostActiveTeamOwners(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { limit = 50, offset = 0, activity_level } = req.query;

    let whereClause = "WHERE oam.owner_email IS NOT NULL";
    const queryParams: any[] = [];

    if (activity_level) {
      whereClause += " AND oam.activity_level = $" + (queryParams.length + 1);
      queryParams.push(activity_level);
    }

    const query = `
      WITH team_owners AS (
        SELECT 
          t.id as team_id,
          t.name as team_name,
          t.user_id as owner_user_id,
          u.email as owner_email,
          u.first_name || ' ' || u.last_name as owner_name,
          t.created_at as team_created_at,
          u.last_active as owner_last_active
        FROM teams t
        JOIN users u ON t.user_id = u.id
      ),
      
      owner_activity_metrics AS (
        SELECT 
          to.owner_user_id,
          to.owner_email,
          to.owner_name,
          to.team_id,
          to.team_name,
          to.team_created_at,
          to.owner_last_active,
          
          COUNT(DISTINCT al.id) as recent_activities,
          COUNT(DISTINCT DATE(al.created_at)) as active_days_last_30,
          COUNT(DISTINCT p.id) as total_projects,
          COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_projects,
          COUNT(DISTINCT tm.id) as total_team_members,
          COUNT(DISTINCT CASE WHEN tm.active = true THEN tm.id END) as active_team_members,
          COUNT(DISTINCT tasks.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN tal.created_at > NOW() - INTERVAL '30 days' THEN tal.id END) as recent_task_activities,
          COUNT(DISTINCT CASE WHEN twl.created_at > NOW() - INTERVAL '30 days' THEN twl.id END) as recent_time_logs,
          MAX(al.created_at) as last_activity_date,
          EXTRACT(DAY FROM NOW() - MAX(al.created_at)) as days_since_last_activity
          
        FROM team_owners to
        LEFT JOIN activity_logs al ON al.user_id = to.owner_user_id AND al.team_id = to.team_id
        LEFT JOIN projects p ON p.team_id = to.team_id AND p.created_by = to.owner_user_id
        LEFT JOIN team_members tm ON tm.team_id = to.team_id
        LEFT JOIN tasks ON tasks.project_id = p.id
        LEFT JOIN task_activity_logs tal ON tal.user_id = to.owner_user_id AND tal.project_id = p.id
        LEFT JOIN task_work_log twl ON twl.user_id = to.owner_user_id AND twl.project_id = p.id
        GROUP BY 
          to.owner_user_id, 
          to.owner_email, 
          to.owner_name, 
          to.team_id, 
          to.team_name, 
          to.team_created_at,
          to.owner_last_active
      ),
      
      activity_scores AS (
        SELECT *,
          LEAST(
            (
              (recent_activities * 0.3) +
              (active_days_last_30 * 4 * 0.2) +
              (total_team_members * 5 * 0.25) +
              (total_projects * 3 * 0.15) +
              (recent_task_activities * 0.1 * 0.1)
            ), 100
          ) as activity_score
        FROM owner_activity_metrics
      )
      
      SELECT 
        oam.owner_email,
        oam.owner_name,
        oam.activity_score,
        oam.recent_activities,
        oam.active_days_last_30,
        oam.total_projects,
        oam.active_projects,
        oam.total_team_members,
        oam.active_team_members,
        oam.total_tasks,
        oam.recent_task_activities,
        oam.recent_time_logs,
        oam.last_activity_date,
        oam.days_since_last_activity,
        oam.team_created_at,
        CASE 
          WHEN oam.activity_score >= 80 THEN 'Highly Active'
          WHEN oam.activity_score >= 50 THEN 'Moderately Active'
          WHEN oam.activity_score >= 20 THEN 'Lightly Active'
          ELSE 'Inactive'
        END as activity_level
      FROM activity_scores oam
      ${whereClause}
      ORDER BY oam.activity_score DESC, oam.recent_activities DESC, oam.active_days_last_30 DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);
    const teamOwners: IActiveTeamOwner[] = result.rows;

    return res.status(200).send(new ServerResponse(true, teamOwners));
  }

  @HandleExceptions()
  public static async getActiveTeamOwnersSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const query = `
      WITH team_owners AS (
        SELECT 
          t.id as team_id,
          t.user_id as owner_user_id,
          u.email as owner_email,
          u.first_name || ' ' || u.last_name as owner_name
        FROM teams t
        JOIN users u ON t.user_id = u.id
      ),
      
      owner_activity_metrics AS (
        SELECT 
          to.owner_user_id,
          to.owner_email,
          to.owner_name,
          COUNT(DISTINCT al.id) as recent_activities,
          COUNT(DISTINCT DATE(al.created_at)) as active_days_last_30,
          COUNT(DISTINCT p.id) as total_projects,
          COUNT(DISTINCT tm.id) as total_team_members,
          MAX(al.created_at) as last_activity_date,
          EXTRACT(DAY FROM NOW() - MAX(al.created_at)) as days_since_last_activity
          
        FROM team_owners to
        LEFT JOIN activity_logs al ON al.user_id = to.owner_user_id AND al.team_id = to.team_id AND al.created_at > NOW() - INTERVAL '30 days'
        LEFT JOIN projects p ON p.team_id = to.team_id
        LEFT JOIN team_members tm ON tm.team_id = to.team_id
        GROUP BY 
          to.owner_user_id, 
          to.owner_email, 
          to.owner_name
      ),
      
      activity_scores AS (
        SELECT *,
          LEAST(
            (
              (recent_activities * 0.3) +
              (active_days_last_30 * 4 * 0.2) +
              (total_team_members * 5 * 0.25) +
              (total_projects * 3 * 0.15)
            ), 100
          ) as activity_score
        FROM owner_activity_metrics
      )
      
      SELECT 
        COUNT(*) as total_team_owners,
        COUNT(CASE WHEN activity_score >= 80 THEN 1 END) as highly_active_count,
        COUNT(CASE WHEN activity_score >= 50 AND activity_score < 80 THEN 1 END) as moderately_active_count,
        COUNT(CASE WHEN activity_score >= 20 AND activity_score < 50 THEN 1 END) as lightly_active_count,
        COUNT(CASE WHEN activity_score < 20 THEN 1 END) as inactive_count,
        ROUND(AVG(activity_score), 2) as average_activity_score,
        ROUND(AVG(recent_activities), 2) as average_recent_activities,
        ROUND(AVG(active_days_last_30), 2) as average_active_days,
        ROUND(AVG(total_projects), 2) as average_projects_per_owner,
        ROUND(AVG(total_team_members), 2) as average_team_size
      FROM activity_scores
      WHERE owner_email IS NOT NULL
    `;

    const result = await db.query(query);
    const summary = result.rows[0];

    return res.status(200).send(new ServerResponse(true, summary));
  }

  @HandleExceptions()
  public static async exportActiveTeamOwners(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { format = 'csv', activity_level } = req.query;

    let whereClause = "WHERE oam.owner_email IS NOT NULL";
    const queryParams: any[] = [];

    if (activity_level) {
      whereClause += " AND oam.activity_level = $" + (queryParams.length + 1);
      queryParams.push(activity_level);
    }

    const query = `
      WITH team_owners AS (
        SELECT 
          t.id as team_id,
          t.name as team_name,
          t.user_id as owner_user_id,
          u.email as owner_email,
          u.first_name || ' ' || u.last_name as owner_name,
          t.created_at as team_created_at,
          u.last_active as owner_last_active
        FROM teams t
        JOIN users u ON t.user_id = u.id
      ),
      
      owner_activity_metrics AS (
        SELECT 
          to.owner_user_id,
          to.owner_email,
          to.owner_name,
          to.team_id,
          to.team_name,
          to.team_created_at,
          to.owner_last_active,
          
          COUNT(DISTINCT al.id) as recent_activities,
          COUNT(DISTINCT DATE(al.created_at)) as active_days_last_30,
          COUNT(DISTINCT p.id) as total_projects,
          COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_projects,
          COUNT(DISTINCT tm.id) as total_team_members,
          COUNT(DISTINCT CASE WHEN tm.active = true THEN tm.id END) as active_team_members,
          COUNT(DISTINCT tasks.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN tal.created_at > NOW() - INTERVAL '30 days' THEN tal.id END) as recent_task_activities,
          COUNT(DISTINCT CASE WHEN twl.created_at > NOW() - INTERVAL '30 days' THEN twl.id END) as recent_time_logs,
          MAX(al.created_at) as last_activity_date,
          EXTRACT(DAY FROM NOW() - MAX(al.created_at)) as days_since_last_activity
          
        FROM team_owners to
        LEFT JOIN activity_logs al ON al.user_id = to.owner_user_id AND al.team_id = to.team_id
        LEFT JOIN projects p ON p.team_id = to.team_id AND p.created_by = to.owner_user_id
        LEFT JOIN team_members tm ON tm.team_id = to.team_id
        LEFT JOIN tasks ON tasks.project_id = p.id
        LEFT JOIN task_activity_logs tal ON tal.user_id = to.owner_user_id AND tal.project_id = p.id
        LEFT JOIN task_work_log twl ON twl.user_id = to.owner_user_id AND twl.project_id = p.id
        GROUP BY 
          to.owner_user_id, 
          to.owner_email, 
          to.owner_name, 
          to.team_id, 
          to.team_name, 
          to.team_created_at,
          to.owner_last_active
      ),
      
      activity_scores AS (
        SELECT *,
          LEAST(
            (
              (recent_activities * 0.3) +
              (active_days_last_30 * 4 * 0.2) +
              (total_team_members * 5 * 0.25) +
              (total_projects * 3 * 0.15) +
              (recent_task_activities * 0.1 * 0.1)
            ), 100
          ) as activity_score
        FROM owner_activity_metrics
      )
      
      SELECT 
        oam.owner_email as "Owner Email",
        oam.owner_name as "Owner Name",
        oam.activity_score as "Activity Score",
        oam.recent_activities as "Recent Activities (30 days)",
        oam.active_days_last_30 as "Active Days (30 days)",
        oam.total_projects as "Total Projects",
        oam.active_projects as "Active Projects",
        oam.total_team_members as "Total Team Members",
        oam.active_team_members as "Active Team Members",
        oam.total_tasks as "Total Tasks",
        oam.recent_task_activities as "Recent Task Activities",
        oam.recent_time_logs as "Recent Time Logs",
        oam.last_activity_date as "Last Activity Date",
        oam.days_since_last_activity as "Days Since Last Activity",
        oam.team_created_at as "Team Created Date",
        CASE 
          WHEN oam.activity_score >= 80 THEN 'Highly Active'
          WHEN oam.activity_score >= 50 THEN 'Moderately Active'
          WHEN oam.activity_score >= 20 THEN 'Lightly Active'
          ELSE 'Inactive'
        END as "Activity Level"
      FROM activity_scores oam
      ${whereClause}
      ORDER BY oam.activity_score DESC, oam.recent_activities DESC, oam.active_days_last_30 DESC
    `;

    const result = await db.query(query, queryParams);
    const data = result.rows;

    if (format === 'csv') {
      // Convert to CSV format
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="active-team-owners.csv"');
      return res.status(200).send(csvContent);
    } else {
      // JSON format
      return res.status(200).send(new ServerResponse(true, data));
    }
  }
}
