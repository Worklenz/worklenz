import {NextFunction} from "express";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import db from "../config/db";
import {log_error} from "../shared/utils";
import {SqlHelper} from "../shared/sql-helpers";

/**
 * Middleware to verify that the authenticated user has access to member allocations
 * by ensuring all allocation IDs belong to projects in the user's team.
 * This prevents IDOR (Insecure Direct Object Reference) attacks.
 * 
 * Usage:
 * - For allocation IDs in request body: verifyMemberAllocationAccess('body', 'ids')
 * 
 * @param location - Where to find the allocation IDs ('body' or 'query')
 * @param fieldName - The name of the field containing the allocation IDs (default: 'ids')
 */
export default function verifyMemberAllocationAccess(
  location: 'body' | 'query' = 'body',
  fieldName: string = 'ids'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    // Get allocation IDs from the specified location
    const idsRaw = req[location]?.[fieldName];

    if (!idsRaw) {
      return res.status(400).send(
        new ServerResponse(false, null, "Allocation IDs are required")
      );
    }

    // Parse IDs - can be array, comma-separated string, or space-separated string
    const ids = Array.isArray(idsRaw)
      ? idsRaw.filter((id: any) => id && typeof id === 'string' && id.trim())
      : typeof idsRaw === 'string'
        ? idsRaw.split(/[,\s]+/).filter((id: string) => id.trim())
        : [];

    if (ids.length === 0) {
      return res.status(400).send(
        new ServerResponse(false, null, "No valid allocation IDs provided")
      );
    }

    try {
      // Validate that all allocation IDs belong to projects the user can access
      const { clause, params } = SqlHelper.buildInClause(ids, 1);
      const validationQuery = `
        SELECT DISTINCT pma.id, pma.project_id
        FROM project_member_allocations pma
        INNER JOIN projects p ON pma.project_id = p.id
        WHERE pma.id IN (${clause}) AND p.team_id = $${params.length + 1}
      `;
      const validationParams = [...params, teamId];
      const validationResult = await db.query(validationQuery, validationParams);

      // Check if all allocations belong to accessible projects
      const accessibleIds = validationResult.rows.map((row: any) => row.id);
      const inaccessibleIds = ids.filter((id: string) => !accessibleIds.includes(id));

      if (inaccessibleIds.length > 0) {
        return res.status(403).send(
          new ServerResponse(
            false,
            null,
            `You do not have permission to access ${inaccessibleIds.length} allocation(s)`
          )
        );
      }

      // All allocations are accessible, continue
      return next();
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying allocation access")
      );
    }
  };
}
