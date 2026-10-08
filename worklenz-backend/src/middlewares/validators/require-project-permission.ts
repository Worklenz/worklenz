import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import {
  getProjectAccessForRequest,
  IProjectPermissions,
} from "../../shared/project-access";

export type ProjectPermissionPath =
  | keyof Omit<IProjectPermissions, "members">
  | "members.add"
  | "members.removeMember"
  | "members.changeMemberRole";

export type ProjectIdSource =
  | "query.current_project_id"
  | "query.project_id"
  | "query.id"
  | "body.project_id"
  | "params.id"
  | "params.projectId"
  | "params.project_id";

const DEFAULT_SOURCES: ProjectIdSource[] = [
  "query.current_project_id",
  "body.project_id",
  "params.projectId",
  "params.project_id",
  "query.project_id",
];

const readSource = (
  req: IWorkLenzRequest,
  source: ProjectIdSource
): string | null => {
  const [root, key] = source.split(".") as [keyof IWorkLenzRequest, string];
  const container = req[root] as Record<string, unknown> | undefined;
  const value = container?.[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
};

export const resolveRequestProjectId = (
  req: IWorkLenzRequest,
  sources: ProjectIdSource[] = DEFAULT_SOURCES
): string | null => {
  for (const source of sources) {
    const value = readSource(req, source);
    if (value) {
      return value;
    }
  }
  return null;
};

export const hasProjectPermission = (
  permissions: IProjectPermissions,
  path: ProjectPermissionPath
): boolean => {
  switch (path) {
    case "members.add":
      return permissions.members.add;
    case "members.removeMember":
      return permissions.members.removeMember;
    case "members.changeMemberRole":
      return permissions.members.changeMemberRole;
    default:
      return Boolean(permissions[path]);
  }
};

export interface RequireProjectPermissionOptions {
  /** Where to read the project id. First match wins. */
  sources?: ProjectIdSource[];
  /** HTTP status when denied (default 403). */
  status?: number;
  message?: string;
}

/**
 * Phase 2 — authorize a project-scoped action from getProjectAccess.
 * Caches access on the request (one membership lookup per project id).
 */
export const requireProjectPermission = (
  permission: ProjectPermissionPath,
  options: RequireProjectPermissionOptions = {}
) => {
  const sources = options.sources ?? DEFAULT_SOURCES;
  const status = options.status ?? 403;
  const message =
    options.message ?? "You are not authorized to perform this action";

  return async (
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
    next: NextFunction
  ): Promise<IWorkLenzResponse | void> => {
    const projectId = resolveRequestProjectId(req, sources);

    if (!projectId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Project id is required"));
    }

    // Keep legacy query in sync for downstream helpers.
    if (!req.query.current_project_id) {
      req.query.current_project_id = projectId;
    }

    const access = await getProjectAccessForRequest(req, projectId);

    if (!hasProjectPermission(access.permissions, permission)) {
      return res.status(status).send(new ServerResponse(false, null, message));
    }

    return next();
  };
};

export default requireProjectPermission;
