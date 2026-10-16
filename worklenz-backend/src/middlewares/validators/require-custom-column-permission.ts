import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import { log_error } from "../../shared/utils";
import { getProjectAccessForRequest } from "../../shared/project-access";
import {
  hasProjectPermission,
  ProjectIdSource,
  ProjectPermissionPath,
  resolveRequestProjectId,
} from "./require-project-permission";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROJECT_HINT_SOURCES: ProjectIdSource[] = [
  "query.current_project_id",
  "query.project_id",
  "body.project_id",
];

interface ICustomColumnRef {
  id: string;
  project_id: string;
}

/**
 * Keys are only unique per project (UNIQUE (project_id, key)) and are copied
 * across projects by task duplication, so a key lookup without a project hint
 * fetches up to two rows to detect ambiguity.
 */
const findCustomColumns = async (
  req: IWorkLenzRequest,
  columnRef: string
): Promise<ICustomColumnRef[]> => {
  if (UUID_REGEX.test(columnRef)) {
    const result = await db.query(
      `SELECT id, project_id FROM cc_custom_columns WHERE id = $1::UUID LIMIT 1`,
      [columnRef]
    );
    return result.rows;
  }

  const projectHint = resolveRequestProjectId(req, PROJECT_HINT_SOURCES);
  if (projectHint && UUID_REGEX.test(projectHint)) {
    const result = await db.query(
      `SELECT id, project_id FROM cc_custom_columns WHERE key = $1 AND project_id = $2::UUID LIMIT 1`,
      [columnRef, projectHint]
    );
    return result.rows;
  }

  const result = await db.query(
    `SELECT id, project_id FROM cc_custom_columns WHERE key = $1 LIMIT 2`,
    [columnRef]
  );
  return result.rows;
};

/**
 * Resolve a custom column's project, then require a project permission.
 * Used for PUT/DELETE where the path carries the column id (UUID) or key.
 * On success `req.params.id` is replaced with the resolved column UUID so the
 * controller acts on exactly the column that was authorized.
 */
export default function requireCustomColumnPermission(
  permission: ProjectPermissionPath
) {
  return async (
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
    next: NextFunction
  ): Promise<IWorkLenzResponse | void> => {
    const columnRef = req.params.id;
    if (!columnRef) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Column id is required"));
    }

    try {
      const columns = await findCustomColumns(req, columnRef);

      if (columns.length === 0) {
        return res
          .status(404)
          .send(new ServerResponse(false, null, "Custom column not found"));
      }

      if (columns.length > 1) {
        return res
          .status(400)
          .send(
            new ServerResponse(
              false,
              null,
              "Custom column key is ambiguous; use the column id or provide project_id"
            )
          );
      }

      const [column] = columns;
      const access = await getProjectAccessForRequest(req, column.project_id);
      if (!hasProjectPermission(access.permissions, permission)) {
        return res
          .status(403)
          .send(
            new ServerResponse(
              false,
              null,
              "You are not authorized to perform this action"
            )
          );
      }

      req.params.id = column.id;
      return next();
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to verify permission"));
    }
  };
}
