import { NextFunction } from "express";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";
import { log_error } from "../shared/utils";
import { NON_GUEST_ACCESS_JOIN, NON_GUEST_ACCESS_PREDICATE } from "../shared/guest-access-sql";

/**
 * Middleware to restrict guest users to only Task List and Board views
 * 
 * Guests can only access:
 * - Task List (v2/v3)
 * - Board/Kanban
 * 
 * All other views are forbidden for guests:
 * - Roadmap/Gantt
 * - Schedule
 * - Workload
 * - Reporting
 * 
 * Usage:
 * - Apply this middleware AFTER verifyProjectAccess on specific routes
 * - verifyGuestViewAccess('params', 'id', 'kanban') 
 * 
 * @param location - Where to find the project ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the project ID
 * @param viewType - The type of view being accessed (kanban, list, roadmap, schedule, workload, reporting)
 */
export default function verifyGuestViewAccess(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id',
  viewType: 'kanban' | 'list' | 'roadmap' | 'schedule' | 'workload' | 'reporting' = 'list'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const projectId = req[location]?.[fieldName];

    if (!projectId || !userId) {
      return next();
    }

    try {
      // Check if user is a guest for this project. Uses the same non-guest predicate as
      // NON_GUEST_ACCESS_PREDICATE (owner/admin and implicit team members never count as
      // guests) so this can't silently disagree with the mutation-side guest checks.
      const nonGuestQuery = `
        SELECT 1
        FROM projects p
        ${NON_GUEST_ACCESS_JOIN('$2')}
        WHERE p.id = $1
          AND ${NON_GUEST_ACCESS_PREDICATE}
        LIMIT 1;
      `;

      const nonGuestResult = await db.query(nonGuestQuery, [projectId, userId]);
      const isGuest = !(nonGuestResult.rowCount && nonGuestResult.rowCount > 0);

      // If user is a guest, check if view type is allowed
      if (isGuest) {
        // Allowed views for guests: kanban and list (v2/v3)
        const allowedViews = ['kanban', 'list'];

        if (!allowedViews.includes(viewType)) {
          return res.status(403).send(
            new ServerResponse(
              false,
              null,
              `Guests can only access Task List and Board views. The ${viewType} view is not available for guest users.`
            )
          );
        }
      }

      // User is not a guest or view is allowed, continue
      next();
    } catch (error) {
      log_error(error);
      // On error, allow access (don't block due to technical issues)
      next();
    }
  };
}
