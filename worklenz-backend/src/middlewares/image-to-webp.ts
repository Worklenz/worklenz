import {NextFunction} from "express";
import sharp from "sharp";

import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";

export default async function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) {
  if (!req.body.file) return next();
  try {
    const buffer = Buffer.from(req.body.file.replace(/^data:(.*?);base64,/, ""), "base64");
    const out = await sharp(buffer)
      .webp({quality: 50})
      .toBuffer();

    req.body.type = "webp";
    req.body.buffer = out;

    return next();
  } catch (error) {
    return res.status(200).send(new ServerResponse(false, null, "Upload failed"));
  }
}
