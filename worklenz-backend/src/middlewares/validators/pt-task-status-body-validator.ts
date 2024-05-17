import {NextFunction} from "express";
import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const {name, template_id, category_id} = req.body;

  if (!name || name.trim() === "")
    return res.status(200).send(new ServerResponse(false, null, "Name is required"));

  if (!template_id || template_id.trim() === "")
    return res.status(400).send(new ServerResponse(false, null));
  if (!category_id || category_id.trim() === "")
    return res.status(400).send(new ServerResponse(false, null));

  req.body.color_code = req.body.color_code || "#a9a9a9";
  req.body.default_status = !!req.body.default_status;
  req.body.name = req.body.name.trim();

  return next();
}