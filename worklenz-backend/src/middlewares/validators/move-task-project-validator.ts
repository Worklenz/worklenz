import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { isValidUuid } from "../../shared/validation-helpers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export default function validateMoveTaskProject(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): IWorkLenzResponse | void {
  const body: unknown = req.body;
  if (!isRecord(body)) return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
  const { task_ids: taskIds, source_project_id: sourceId, destination_project_id: destinationId, mapping, options } = body;
  const validId = (value: unknown): value is string => typeof value === "string" && isValidUuid(value);
  const validMap = (value: unknown): value is Record<string, string> =>
    isRecord(value) && Object.values(value).every(item => typeof item === "string" && item.length > 0);

  if (!Array.isArray(taskIds) || taskIds.length === 0 || !taskIds.every(validId) || !validId(sourceId) || !validId(destinationId) || sourceId === destinationId) {
    return res.status(400).send(new ServerResponse(false, null, "Valid task IDs and distinct project IDs are required"));
  }
  if (!isRecord(mapping) || !validMap(mapping.status) || (mapping.phase !== undefined && !validMap(mapping.phase)) || (mapping.custom_fields !== undefined && !validMap(mapping.custom_fields))) {
    return res.status(400).send(new ServerResponse(false, null, "Invalid field mapping"));
  }
  if (!isRecord(options) || typeof options.move_subtasks !== "boolean" || typeof options.keep_assignees_if_member_exists !== "boolean" || typeof options.keep_labels_by_name !== "boolean") {
    return res.status(400).send(new ServerResponse(false, null, "Invalid move options"));
  }
  return next();
}
