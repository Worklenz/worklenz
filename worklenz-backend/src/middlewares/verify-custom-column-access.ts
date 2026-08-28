import {NextFunction} from "express";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import db from "../config/db";
import {log_error} from "../shared/utils";
import {NON_GUEST_ACCESS_JOIN, NON_GUEST_ACCESS_PREDICATE} from "../shared/guest-access-sql";

/**
 * Middleware to verify the user has access to a custom column's project via team
 * membership. Resolves the column's project from cc_custom_columns.id.
 *
 * @param location - Where to find the column ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the column ID
 */
export default function verifyCustomColumnAccess(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const columnId = req[location]?.[fieldName];

    if (!columnId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Custom column ID is required")
      );
    }

    if (!userId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      const q = `
        SELECT 1
        FROM cc_custom_columns cc
        INNER JOIN projects p ON cc.project_id = p.id
        INNER JOIN team_members tm ON p.team_id = tm.team_id
        WHERE cc.id = $1 AND tm.user_id = $2
        LIMIT 1;
      `;
      const result = await db.query(q, [columnId, userId]);

      if (result.rowCount && result.rowCount > 0) {
        return next();
      }

      return res.status(403).send(
        new ServerResponse(false, null, "You do not have permission to access this custom column")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying custom column access")
      );
    }
  };
}

/**
 * Middleware to verify the user has non-guest access to a custom column's project —
 * for mutating requests (update/delete). Resolves the column's project from
 * cc_custom_columns.id.
 *
 * @param location - Where to find the column ID ('params', 'body', or 'query')
 * @param fieldName - The name of the field containing the column ID
 */
export function verifyNonGuestCustomColumnAccess(
  location: 'params' | 'body' | 'query' = 'params',
  fieldName: string = 'id'
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const columnId = req[location]?.[fieldName];

    if (!columnId) {
      return res.status(400).send(
        new ServerResponse(false, null, "Custom column ID is required")
      );
    }

    if (!userId) {
      return res.status(401).send(
        new ServerResponse(false, null, "Authentication required")
      );
    }

    try {
      const q = `
        SELECT 1
        FROM cc_custom_columns cc
        INNER JOIN projects p ON cc.project_id = p.id
        ${NON_GUEST_ACCESS_JOIN('$2')}
        WHERE cc.id = $1
          AND ${NON_GUEST_ACCESS_PREDICATE}
        LIMIT 1;
      `;
      const result = await db.query(q, [columnId, userId]);

      if (result.rowCount && result.rowCount > 0) {
        return next();
      }

      return res.status(403).send(
        new ServerResponse(false, null, "Guests do not have permission to modify custom columns")
      );
    } catch (error) {
      log_error(error);
      return res.status(500).send(
        new ServerResponse(false, null, "An error occurred while verifying custom column access")
      );
    }
  };
}
