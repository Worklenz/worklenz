import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {content, task_id} = req.body;
  // if (!content)
  //   return res.status(200).send(new ServerResponse(false, null, "Comment message is required"));
  if (!task_id)
    return res.status(200).send(new ServerResponse(false, null, "Unable to create comment"));
  if (content.length > 5000)
    return res.status(200).send(new ServerResponse(false, null, "Message length exceeded"));

  req.body.mentions = Array.isArray(req.body.mentions)
    ? req.body.mentions
    : [];

  return next();
}
