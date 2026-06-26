import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";

// Define the expected shape of the options object
interface CopyTaskOptions {
  subtasks: boolean;
  attachments: boolean;
  dates: boolean;
  dependencies: boolean;
  assignees: boolean;
  labels: boolean;
  customFields: boolean;
  subscribers: boolean;
}

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const { options, task_id, project_id } = req.body;

  // Required top-level fields
  if (!task_id) {
    return res.status(200).send(new ServerResponse(false, null, "Task id is required"));
  }

  if (!project_id) {
    return res.status(200).send(new ServerResponse(false, null, "Project id is required"));
  }

  // Check if options exists and is an object
  if (!options || typeof options !== "object") {
    return res.status(200).send(new ServerResponse(false, null, "Options object is required"));
  }

  // List of required keys in options
  const requiredOptions: (keyof CopyTaskOptions)[] = [
    "subtasks",
    "attachments",
    "dates",
    "dependencies",
    "assignees",
    "labels",
    "customFields",
    "subscribers"
  ];

  // Check for missing or invalid (non-boolean) properties
  for (const key of requiredOptions) {
    if (!(key in options)) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, `Options.${key} is required`));
    }
    if (typeof options[key] !== "boolean") {
      return res
        .status(200)
        .send(new ServerResponse(false, null, `Options.${key} must be a boolean`));
    }
  }

  // All validations passed
  return next();
}