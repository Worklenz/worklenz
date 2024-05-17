import {NextFunction, Request, Response} from "express";
import {Schema, Validator} from "jsonschema";
import {ServerResponse} from "../models/server-response";

export default function (schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validator = new Validator();
    const result = validator.validate(req.body, schema);

    if (!result.valid)
      return res.status(400).send(new ServerResponse(false, null, (result.errors[0]?.schema as any).message || null));

    return next();
  };
}
