import { NextFunction } from "express";
import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";

/** Check workspace membership before project middleware can switch active teams. */
export default async function verifyMoveProjectWorkspace(
  req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction
): Promise<IWorkLenzResponse | void> {
  if (!req.user?.team_id) return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
  try {
    const result = await db.query(
      "SELECT id FROM projects WHERE id = ANY($1::UUID[]) AND team_id = $2",
      [[req.body.source_project_id, req.body.destination_project_id], req.user.team_id]
    );
    if (result.rowCount !== 2) return res.status(403).send(new ServerResponse(false, null, "Projects must belong to the current workspace"));
    next();
  } catch {
    return res.status(500).send(new ServerResponse(false, null, "Unable to verify projects"));
  }
}
