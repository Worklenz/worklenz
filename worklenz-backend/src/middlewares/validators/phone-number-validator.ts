import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import {isValidPhoneNumber} from "../../shared/utils";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const phone = req.body.phone || req.body.contact_number || req.body.contact_phone;

  if (phone && !isValidPhoneNumber(phone)) {
    return res.status(200).send(
      new ServerResponse(false, null, "Invalid phone number format. Use international format (e.g., +1-234-567-8900)")
    );
  }

  return next();
}
