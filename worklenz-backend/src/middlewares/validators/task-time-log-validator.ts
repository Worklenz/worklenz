import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {

  const {id, seconds_spent, created_at, formatted_start} = req.body;

  if (!id || !seconds_spent || !formatted_start) return res.sendStatus(400);

  return next();
}
