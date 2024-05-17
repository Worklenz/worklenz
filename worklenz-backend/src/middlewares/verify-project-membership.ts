import {NextFunction} from "express";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import createHttpError from "http-errors";
import db from "../config/db";

export default function (projectId: string) {
  return async (req: IWorkLenzRequest, _res: IWorkLenzResponse, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    try {
      const q = `
        SELECT 1
        FROM project_members
        WHERE project_id = $1
          AND team_member_id = (SELECT id FROM team_members WHERE team_id = $2 AND user_id = $3);
      `;
      const result = await db.query(q, [projectId, teamId, userId]);
      if (result.rowCount)
        return next();
    } catch (error) {
      // ignored
    }

    return next(createHttpError(401));
  };
}
