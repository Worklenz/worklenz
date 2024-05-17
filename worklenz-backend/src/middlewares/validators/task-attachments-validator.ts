import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {file, file_name, project_id, size} = req.body;

  if (!file || !file_name || !project_id || !size)
    return res.status(200).send(new ServerResponse(false, null, "Upload failed"));

  if (size > 5.243e+7)
    return res.status(200).send(new ServerResponse(false, null, "Max file size for attachments is 50 MB.").withTitle("Upload failed!"));

  req.body.type = file_name.split(".").pop();

  req.body.task_id = req.body.task_id || null;

  return next();
}
