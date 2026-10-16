import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import {isValidUuid} from "../../shared/validation-helpers";

/** Validates the `:userId` route param (idParamValidator only checks `:id`). */
export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  if (!req.params.userId) {
    return res.status(400).send(new ServerResponse(false, null, "User ID parameter is required"));
  }

  if (!isValidUuid(req.params.userId)) {
    return res.status(400).send(new ServerResponse(false, null, "Invalid user ID format. Must be a valid UUID"));
  }

  return next();
}
