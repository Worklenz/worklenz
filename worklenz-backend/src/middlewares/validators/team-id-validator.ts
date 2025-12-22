import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

/**
 * Middleware to validate that the user has a valid team_id before performing operations
 * that require team context (e.g., creating clients, projects, etc.)
 */
export default async function teamIdValidator(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<IWorkLenzResponse | void> {
  const teamId = req.user?.team_id;

  // Check if team_id is missing, undefined, or the invalid all-zeros UUID
  if (!teamId || teamId === '00000000-0000-0000-0000-000000000000') {
    return res.status(400).send(
      new ServerResponse(
        false,
        null,
        "No valid team associated with your account. Please ensure you are logged into a valid team before performing this action."
      )
    );
  }

  return next();
}
