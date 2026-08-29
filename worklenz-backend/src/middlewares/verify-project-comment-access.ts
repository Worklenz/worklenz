import { NextFunction } from "express";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import db from "../config/db";
import { log_error } from "../shared/utils";
import { isValidUuid } from "../shared/validation-helpers";

/**
 * Middleware to verify the user can act on a project comment when only the
 * comment id is known (reactions, edits, edit history). Resolves the
 * comment's project, requires it to belong to the user's active team, then
 * applies the same role rules as verify-project-access: Owner/Admin/Team
 * Lead pass, regular members must be project members.
 *
 * Usage:
 * - Comment id in URL params:  verifyProjectCommentAccess('params', 'comment_id')
 * - Comment id in request body: verifyProjectCommentAccess('body', 'comment_id')
 */
export default function verifyProjectCommentAccess(
  location: "params" | "body" = "params",
  fieldName = "comment_id"
) {
  return async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const commentId = req[location]?.[fieldName];

    if (!commentId || !isValidUuid(commentId)) {
      return res.status(400).send(new ServerResponse(false, null, "Comment ID is required"));
    }

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
    }

    try {
      const commentQuery = `
        SELECT pc.project_id
        FROM project_comments pc
        INNER JOIN projects p ON p.id = pc.project_id
        WHERE pc.id = $1 AND p.team_id = $2
        LIMIT 1;
      `;
      const commentResult = await db.query(commentQuery, [commentId, teamId]);

      if (!commentResult.rowCount) {
        return res.status(404).send(new ServerResponse(false, null, "Comment not found"));
      }

      const projectId = commentResult.rows[0].project_id;

      if (req.user?.owner || req.user?.is_admin) {
        return next();
      }

      const accessQuery = `
        SELECT 1
        FROM team_members tm
        LEFT JOIN roles r ON tm.role_id = r.id
        LEFT JOIN project_members pm
          ON pm.team_member_id = tm.id AND pm.project_id = $1
        WHERE tm.user_id = $2
          AND tm.team_id = $3
          AND (r.admin_role = TRUE OR pm.id IS NOT NULL)
        LIMIT 1;
      `;
      const accessResult = await db.query(accessQuery, [projectId, userId, teamId]);

      if (accessResult.rowCount) {
        return next();
      }

      return res
        .status(403)
        .send(new ServerResponse(false, null, "You do not have permission to access this project"));
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .send(new ServerResponse(false, null, "An error occurred while verifying access"));
    }
  };
}
