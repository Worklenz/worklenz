import {NextFunction} from "express";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {file, file_name, size} = req.body;

  if (!file || !file_name || !size)
    return res.status(200).send(new ServerResponse(false, null, "Upload failed"));

  if (size > 200000)
    return res.status(200).send(new ServerResponse(false, null, "Max file size 200kb.").withTitle("Upload failed!"));

  req.body.type = file_name.split(".").pop();

  if (req.body.type !== "png" && req.body.type !== "jpg" && req.body.type !== "jpeg")
    return res.status(200).send(new ServerResponse(false, null, "Invalid file type"));

  return next();
}
