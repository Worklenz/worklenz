import {NextFunction} from "express";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import db from "../config/db";
import {log_error} from "../shared/utils";

/**
 * Middleware to verify user has access to a project
 * 
 * Access Rules:
 * - Owner: Can access all projects in their team
 * - Admin: Can access all projects in their team
 * - Team Lead: Can access all projects in their team
 * - Member: Can only access projects they are explicitly added to as project members
 * 
 * Usage:
 * - For project ID in URL params: verifyProjectAccess('params', 'id')
 * - For project ID in request body: verifyProjectAccess('body', 'project_id')
 * - For project ID in query params: verifyProjectAccess('query', 'project_id')
 * 
 * @param location - Where to find the project ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the project ID
 */
export default function verifyProjectAccess(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const projectId = req[location]?.[fieldName];
    const isOwner = req.user?.owner;
    const isAdmin = req.user?.is_admin;

    if (!projectId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Project ID is required")
      );
    }

    if (!teamId || !userId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      // First, get the project's team_id
      const projectTeamQuery = `
        SELECT team_id
        FROM projects
        WHERE id = $1
        LIMIT 1;
      `;
      const projectTeamResult = await db.query(projectTeamQuery, [projectId]);
      
      if (!projectTeamResult.rowCount || projectTeamResult.rowCount === 0) {
        return res.status(404).send(
          new ServerResponse(false, null, "Project not found")
        );
      }

      const projectTeamId = projectTeamResult.rows[0].team_id;
      
      // Check if project belongs to user's current active team
      if (projectTeamId !== teamId) {
        // Check if user has access to the project's team (is a member of that team)
        const userTeamAccessQuery = `
          SELECT tm.id, r.owner, r.admin_role
          FROM team_members tm
          INNER JOIN roles r ON tm.role_id = r.id
          WHERE tm.user_id = $1 AND tm.team_id = $2
          LIMIT 1;
        `;
        const userTeamAccessResult = await db.query(userTeamAccessQuery, [userId, projectTeamId]);
        
        if (userTeamAccessResult.rowCount && userTeamAccessResult.rowCount > 0) {
          const userTeamRole = userTeamAccessResult.rows[0];
          const isOwnerOfProjectTeam = userTeamRole.owner;
          const isAdminOfProjectTeam = userTeamRole.admin_role;
          
          // Before switching teams, verify user would actually have access to the project in that team
          const hasProjectAccessInTeam = await checkProjectAccessInTeam(projectId, userId, projectTeamId, isOwnerOfProjectTeam, isAdminOfProjectTeam);
          
          if (hasProjectAccessInTeam) {
            try {
              // Call the activate_team database function to switch teams
              const activateTeamQuery = `SELECT activate_team($1, $2)`;
              await db.query(activateTeamQuery, [projectTeamId, userId]);
              
              // Update the request user's team_id to reflect the new active team
              if (req.user) {
                req.user.team_id = projectTeamId;
              }
              // Continue with the request - user is now in the correct team
              return next();
            } catch (switchError) {
              log_error(switchError);
              console.error(`[AUTO_TEAM_SWITCH] Failed to switch user ${userId} to team ${projectTeamId}:`, switchError);
              
              // If team switch fails, return error
              return res.status(500).send(
                new ServerResponse(false, null, "Failed to switch teams. Please try again.")
              );
            }
          } else {
            // User has access to the team but not to the specific project
            logUnauthorizedAccess(userId, teamId, 'project', projectId, req.path, 'NO_PROJECT_ACCESS_IN_TEAM');
            return res.status(403).send(
              new ServerResponse(false, null, "You do not have permission to access this project")
            );
          }
        }
        
        // User doesn't have access to the project's team at all
        logUnauthorizedAccess(userId, teamId, 'project', projectId, req.path, 'NO_TEAM_ACCESS');
        return res.status(403).send(
          new ServerResponse(false, null, "You do not have permission to access this project")
        );
      }

      // Project belongs to user's current team, now check role-based access
      // If user is Owner or Admin, they can access all projects in their team
      if (isOwner || isAdmin) {
        return next();
      }

      // Check if user is a Team Lead (admin_role = true)
      const teamLeadQuery = `
        SELECT 1
        FROM team_members tm
        INNER JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = $1 
          AND tm.team_id = $2 
          AND r.admin_role = TRUE
        LIMIT 1;
      `;
      const teamLeadResult = await db.query(teamLeadQuery, [userId, teamId]);
      
      if (teamLeadResult.rowCount && teamLeadResult.rowCount > 0) {
        return next();
      }

      // For regular members, check if they are explicitly added to the project
      const projectMemberQuery = `
        SELECT 1
        FROM project_members pm
        INNER JOIN team_members tm ON pm.team_member_id = tm.id
        WHERE pm.project_id = $1 
          AND tm.user_id = $2 
          AND tm.team_id = $3
        LIMIT 1;
      `;
      const projectMemberResult = await db.query(projectMemberQuery, [projectId, userId, teamId]);
      
      if (projectMemberResult.rowCount && projectMemberResult.rowCount > 0) {
        return next();
      }
      
      // User is a member but not part of this project
      logUnauthorizedAccess(userId, teamId, 'project', projectId, req.path, 'NOT_PROJECT_MEMBER');
      
      return res.status(403).send(
        new ServerResponse(false, null, "You do not have permission to access this project")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying project access")
      );
    }
  };
}

/**
 * Helper function to verify project access programmatically
 */
export async function hasProjectAccess(projectId: string, teamId: string): Promise<boolean> {
  try {
    const q = `SELECT 1 FROM projects WHERE id = $1 AND team_id = $2 LIMIT 1;`;
    const result = await db.query(q, [projectId, teamId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    log_error(error);
    return false;
  }
}

/**
 * Helper function to check if user would have access to a project in a specific team
 * This is used to verify access before suggesting team switch
 */
async function checkProjectAccessInTeam(
  projectId: string, 
  userId: string, 
  teamId: string, 
  isOwner: boolean, 
  isAdmin: boolean
): Promise<boolean> {
  try {
    // If user is Owner or Admin of the team, they can access all projects in that team
    if (isOwner || isAdmin) {
      return true;
    }

    // Check if user is a Team Lead in that team (admin_role = true)
    const teamLeadQuery = `
      SELECT 1
      FROM team_members tm
      INNER JOIN roles r ON tm.role_id = r.id
      WHERE tm.user_id = $1 
        AND tm.team_id = $2 
        AND r.admin_role = TRUE
      LIMIT 1;
    `;
    const teamLeadResult = await db.query(teamLeadQuery, [userId, teamId]);
    
    if (teamLeadResult.rowCount && teamLeadResult.rowCount > 0) {
      return true;
    }

    // For regular members, check if they are explicitly added to the project
    const projectMemberQuery = `
      SELECT 1
      FROM project_members pm
      INNER JOIN team_members tm ON pm.team_member_id = tm.id
      WHERE pm.project_id = $1 
        AND tm.user_id = $2 
        AND tm.team_id = $3
      LIMIT 1;
    `;
    const projectMemberResult = await db.query(projectMemberQuery, [projectId, userId, teamId]);
    
    return projectMemberResult.rowCount ? projectMemberResult.rowCount > 0 : false;
  } catch (error) {
    log_error(error);
    return false;
  }
}

/**
 * Log unauthorized access attempts
 */
function logUnauthorizedAccess(
  userId: string,
  teamId: string,
  resourceType: string,
  resourceId: string,
  path: string,
  reason?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    severity: "SECURITY_WARNING",
    type: "UNAUTHORIZED_API_ACCESS",
    userId,
    teamId,
    resourceType,
    resourceId,
    path,
    reason: reason || 'UNKNOWN'
  };
  
  console.error("[SECURITY]", JSON.stringify(logEntry));
}
