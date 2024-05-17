import {NextFunction} from "express";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) {
  // Map string[] -> Array<{ id: string; }>
  req.body.tasks = req.body.tasks.map((id: string) => ({id}));
  return next();
}
