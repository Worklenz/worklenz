import {NextFunction} from "express";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import db from "../config/db";
import {log_error} from "../shared/utils";

/**
 * Middleware to verify user has access to a project via their team
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
      const q = `
        SELECT 1
        FROM projects
        WHERE id = $1 AND team_id = $2
        LIMIT 1;
      `;
      const result = await db.query(q, [projectId, teamId]);
      
      if (result.rowCount && result.rowCount > 0) {
        return next();
      }
      
      logUnauthorizedAccess(userId, teamId, 'project', projectId, req.path);
      
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
 * Log unauthorized access attempts
 */
function logUnauthorizedAccess(
  userId: string,
  teamId: string,
  resourceType: string,
  resourceId: string,
  path: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    severity: "SECURITY_WARNING",
    type: "UNAUTHORIZED_API_ACCESS",
    userId,
    teamId,
    resourceType,
    resourceId,
    path
  };
  
  console.error("[SECURITY]", JSON.stringify(logEntry));
}
