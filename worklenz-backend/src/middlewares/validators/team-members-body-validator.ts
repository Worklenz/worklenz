import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import {isValidateEmail} from "../../shared/utils";
import {MAX_INVITATIONS_PER_REQUEST} from "../../shared/constants";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {emails} = req.body;

  if (!Array.isArray(emails) || !emails.length)
    return res.status(200).send(new ServerResponse(false, null, "Email addresses cannot be empty"));

  // Prevent array manipulation attacks by limiting the number of emails per request
  if (emails.length > MAX_INVITATIONS_PER_REQUEST) {
    return res.status(200).send(
      new ServerResponse(
        false,
        null,
        `Cannot send more than ${MAX_INVITATIONS_PER_REQUEST} invitations at once. Please send invitations in smaller batches.`
      )
    );
  }

  for (const email of emails) {
    if (typeof email !== "string") {
      return res.status(200).send(new ServerResponse(false, null, "Invalid email address format. Each email must be a string."));
    }

    if (!isValidateEmail(email.trim()))
      return res.status(200).send(new ServerResponse(false, null, "Invalid email address"));
  }

  return next();
}
