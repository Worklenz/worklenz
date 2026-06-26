import {NextFunction, Request, Response} from "express";
import {Schema, Validator} from "jsonschema";
import {ServerResponse} from "../models/server-response";

export default function (schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validator = new Validator();
    const result = validator.validate(req.body, schema);

    if (!result.valid) {
      const schemaMessage = (result.errors[0]?.schema as any)?.message as string | undefined;
      const validationMessage = result.errors[0]?.message;
      const field = result.errors[0]?.property?.replace(/^instance\.?/, "") || "";
      const fallback = field
        ? `Invalid value for field "${field}": ${validationMessage}`
        : validationMessage || "Invalid request body";
      return res.status(400).send(new ServerResponse(false, null, schemaMessage || fallback));
    }

    return next();
  };
}
