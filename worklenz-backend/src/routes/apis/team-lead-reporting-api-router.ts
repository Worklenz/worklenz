import express from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import safeControllerFunction from "../../shared/safe-controller-function";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";

const teamLeadReportingApiRouter = express.Router();

/**
 * Get all Team Leads with their managed members for reporting purposes
 * Used by Admins/Owners to filter members by Team Lead in reporting
 */
teamLeadReportingApiRouter.get("/team-leads-with-members", teamOwnerOrAdminValidator, safeControllerFunction(async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  try {
    const teamId = req.user?.team_id;
    
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID required"));
    }

    const query = `
      SELECT 
        tl.id as team_lead_id,
        tl_user.name as team_lead_name,
        tl_user.email as team_lead_email,
        tl_user.avatar_url as team_lead_avatar_url,
        COALESCE(
          JSON_AGG(
            CASE 
              WHEN tlmm.managed_member_id IS NOT NULL 
              THEN JSON_BUILD_OBJECT(
                'member_id', tlmm.managed_member_id,
                'member_name', tlmm.managed_member_name,
                'member_email', tlmm.managed_member_email,
                'member_avatar_url', managed_user.avatar_url,
                'member_role_name', tlmm.managed_member_role_name,
                'hierarchy_level', tlmm.level
              )
              ELSE NULL 
            END
          ) FILTER (WHERE tlmm.managed_member_id IS NOT NULL),
          '[]'::json
        ) as managed_members
      FROM team_members tl
      JOIN users tl_user ON tl.user_id = tl_user.id
      JOIN roles tl_role ON tl.role_id = tl_role.id
      LEFT JOIN team_lead_managed_members tlmm ON tl.id = tlmm.manager_id
      LEFT JOIN users managed_user ON tlmm.managed_member_user_id = managed_user.id
      WHERE tl.team_id = $1::UUID 
        AND tl.active = TRUE
        AND tl_role.name = 'Team Lead'
      GROUP BY tl.id, tl_user.name, tl_user.email, tl_user.avatar_url
      ORDER BY tl_user.name
    `;

    const result = await db.query(query, [teamId]);
    return res.send(new ServerResponse(true, result.rows));

  } catch (error) {
    // Log error for debugging
    return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
  }
}));

/**
 * Get managed members for a specific Team Lead
 * Used when filtering by a specific Team Lead
 */
teamLeadReportingApiRouter.get("/team-lead-members/:teamLeadId", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  try {
    const teamId = req.user?.team_id;
    const teamLeadId = req.params.id;

    if (!teamId || !teamLeadId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID and Team Lead ID are required"));
    }

    const query = `
      SELECT 
        tlmm.managed_member_id as member_id,
        tlmm.managed_member_name as member_name,
        tlmm.managed_member_email as member_email,
        managed_user.avatar_url as member_avatar_url,
        tlmm.managed_member_role_name as member_role_name,
        tlmm.level as hierarchy_level
      FROM team_lead_managed_members tlmm
      JOIN users managed_user ON tlmm.managed_member_user_id = managed_user.id
      WHERE tlmm.manager_id = $1::UUID 
        AND tlmm.team_id = $2::UUID
      ORDER BY tlmm.level, tlmm.managed_member_name
    `;

    const result = await db.query(query, [teamLeadId, teamId]);
    return res.send(new ServerResponse(true, result.rows));

  } catch (error) {
    // Log error for debugging
    return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
  }
}));

/**
 * Get Team Lead hierarchy information for reporting
 * Returns Team Leads with their managed member counts and statistics
 */
teamLeadReportingApiRouter.get("/team-lead-hierarchy", teamOwnerOrAdminValidator, safeControllerFunction(async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  try {
    const teamId = req.user?.team_id;
    
    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID required"));
    }

    const query = `
      SELECT 
        tl.id as team_lead_id,
        tl_user.name as team_lead_name,
        tl_user.email as team_lead_email,
        tl_user.avatar_url as team_lead_avatar_url,
        COALESCE(tlms.managed_member_count, 0) as managed_members_count,
        COALESCE(tlms.total_tasks, 0) as total_tasks,
        COALESCE(tlms.completed_tasks, 0) as completed_tasks,
        COALESCE(tlms.completion_percentage, 0) as completion_percentage,
        COALESCE(tlms.total_time_minutes, 0) as total_time_minutes,
        COALESCE(tlms.overdue_tasks, 0) as overdue_tasks,
        COALESCE(tlms.active_projects, 0) as active_projects
      FROM team_members tl
      JOIN users tl_user ON tl.user_id = tl_user.id
      JOIN roles tl_role ON tl.role_id = tl_role.id
      LEFT JOIN team_lead_member_stats tlms ON tl.id = tlms.manager_id
      WHERE tl.team_id = $1::UUID 
        AND tl.active = TRUE
        AND tl_role.name = 'Team Lead'
      ORDER BY managed_members_count DESC, tl_user.name
    `;

    const result = await db.query(query, [teamId]);
    return res.send(new ServerResponse(true, result.rows));

  } catch (error) {
    // Log error for debugging
    return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
  }
}));

/**
 * Get detailed performance data for a specific Team Lead's managed members
 * Returns individual member performance metrics
 */
teamLeadReportingApiRouter.get("/team-lead-performance/:teamLeadId", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  try {
    const teamId = req.user?.team_id;
    const teamLeadId = req.params.id;

    if (!teamId || !teamLeadId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID and Team Lead ID are required"));
    }

    const query = `
      SELECT 
        tlmp.managed_member_id,
        tlmp.managed_member_name,
        tlmp.managed_member_email,
        managed_user.avatar_url as member_avatar_url,
        tlmp.managed_member_role_name,
        tlmp.hierarchy_level,
        tlmp.assigned_tasks,
        tlmp.completed_tasks,
        tlmp.completion_percentage,
        tlmp.total_time_minutes,
        tlmp.overdue_tasks,
        tlmp.active_projects,
        tlmp.last_time_log
      FROM team_lead_member_performance tlmp
      JOIN users managed_user ON tlmp.managed_member_user_id = managed_user.id
      WHERE tlmp.manager_id = $1::UUID 
        AND tlmp.manager_user_id IN (
          SELECT user_id FROM team_members 
          WHERE id = $1::UUID AND team_id = $2::UUID
        )
      ORDER BY tlmp.hierarchy_level, tlmp.completion_percentage DESC, tlmp.managed_member_name
    `;

    const result = await db.query(query, [teamLeadId, teamId]);
    return res.send(new ServerResponse(true, result.rows));

  } catch (error) {
    // Log error for debugging
    return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
  }
}));

/**
 * Get time logs for a specific Team Lead's managed members
 * Used for detailed time tracking reports
 */
teamLeadReportingApiRouter.get("/team-lead-time-logs/:teamLeadId", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  try {
    const teamId = req.user?.team_id;
    const teamLeadId = req.params.id;
    const { startDate, endDate, limit = 100 } = req.query;

    if (!teamId || !teamLeadId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID and Team Lead ID are required"));
    }

    let dateFilter = "";
    const params = [teamLeadId, teamId];

    if (startDate && endDate) {
      dateFilter = "AND tlttl.logged_at BETWEEN $3::DATE AND $4::DATE";
      params.push(startDate as string, endDate as string);
    }

    const query = `
      SELECT 
        tlttl.managed_member_id,
        tlttl.managed_member_name,
        tlttl.time_log_id,
        tlttl.time_spent,
        tlttl.description,
        tlttl.logged_by_timer,
        tlttl.logged_at,
        tlttl.task_id,
        tlttl.task_name,
        tlttl.project_id,
        tlttl.project_name
      FROM team_lead_time_logs tlttl
      WHERE tlttl.manager_id = $1::UUID 
        AND tlttl.manager_user_id IN (
          SELECT user_id FROM team_members 
          WHERE id = $1::UUID AND team_id = $2::UUID
        )
        ${dateFilter}
      ORDER BY tlttl.logged_at DESC, tlttl.managed_member_name
      LIMIT ${parseInt(limit as string, 10)}
    `;

    const result = await db.query(query, params);
    return res.send(new ServerResponse(true, result.rows));

  } catch (error) {
    // Log error for debugging
    return res.status(500).send(new ServerResponse(false, null, error instanceof Error ? error.message : "Unknown error"));
  }
}));

export default teamLeadReportingApiRouter;