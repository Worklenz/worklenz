import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";

// "task" is deliberately absent: per-task totals are the flat table's "By task"
// view now, not a grouping. (Older rows may still hold it — the column's CHECK
// constraint predates its removal — and the frontend maps it on read.)
const VALID_GROUP_BY = ["none", "member", "client", "project"];
const VALID_SCOPE = ["my", "all"];

export default function timeEntriesPreferenceValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): IWorkLenzResponse | void {
  const { group_by, scope } = req.body || {};

  if (group_by === undefined && scope === undefined) {
    return res.status(400).send(new ServerResponse(false, null, "group_by or scope is required"));
  }

  if (group_by !== undefined && !VALID_GROUP_BY.includes(group_by)) {
    return res.status(400).send(new ServerResponse(false, null, `group_by must be one of: ${VALID_GROUP_BY.join(", ")}`));
  }

  if (scope !== undefined && !VALID_SCOPE.includes(scope)) {
    return res.status(400).send(new ServerResponse(false, null, `scope must be one of: ${VALID_SCOPE.join(", ")}`));
  }

  return next();
}
