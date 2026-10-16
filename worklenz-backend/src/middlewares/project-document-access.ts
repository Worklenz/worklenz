import { NextFunction } from "express";

import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { isValidUuid } from "../shared/validation-helpers";

const assignProjectId = (req: IWorkLenzRequest, projectId: string) => {
  req.query.project_id = projectId;
  if (!req.query.current_project_id) {
    req.query.current_project_id = projectId;
  }
};

export const attachDocumentProject = async (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
) => {
  const documentId = req.params.id;
  if (!documentId || !isValidUuid(documentId)) {
    return res.status(400).send(new ServerResponse(false, null, "Invalid document id"));
  }

  const result = await db.query(
    `SELECT project_id
     FROM project_documents
     WHERE id = $1 AND deleted_at IS NULL`,
    [documentId]
  );
  const projectId = result.rows[0]?.project_id as string | undefined;
  if (!projectId) {
    return res.status(404).send(new ServerResponse(false, null, "Document not found"));
  }

  assignProjectId(req, projectId);
  return next();
};

export const attachTaskProject = async (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
) => {
  const taskId = req.params.taskId;
  if (!taskId || !isValidUuid(taskId)) {
    return res.status(400).send(new ServerResponse(false, null, "Invalid task id"));
  }

  const result = await db.query(`SELECT project_id FROM tasks WHERE id = $1`, [taskId]);
  const projectId = result.rows[0]?.project_id as string | undefined;
  if (!projectId) {
    return res.status(404).send(new ServerResponse(false, null, "Task not found"));
  }

  assignProjectId(req, projectId);
  return next();
};
