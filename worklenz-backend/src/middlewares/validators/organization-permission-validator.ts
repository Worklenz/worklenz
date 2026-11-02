import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import {
  hasOrganizationPermission,
  ORGANIZATION_PERMISSIONS,
  OrganizationPermission,
} from "../../shared/organization-permissions";
import { getEffectiveTeamRole, TEAM_ROLE_NAMES } from "../../shared/team-permissions";

const NOT_AUTHORIZED_MESSAGE = "You are not authorized to perform this action";
const READ_METHODS = ["GET", "HEAD", "OPTIONS"];

// 403 (not 401): the frontend treats 401 as an expired session and logs the user out
const sendForbidden = (res: IWorkLenzResponse) =>
  res.status(403).send(new ServerResponse(false, null, NOT_AUTHORIZED_MESSAGE));

const isOwnerOrAdmin = (req: IWorkLenzRequest) => {
  const role = getEffectiveTeamRole(req.user);
  return !!req.user && (role === TEAM_ROLE_NAMES.OWNER || role === TEAM_ROLE_NAMES.ADMIN);
};

export const organizationPermissionValidator = (permission: OrganizationPermission) =>
  async (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<IWorkLenzResponse | void> => {
    try {
      if (await hasOrganizationPermission(req.user, permission)) return next();
      return sendForbidden(res);
    } catch (error) {
      return next(error);
    }
  };

export const viewReportsValidator = organizationPermissionValidator(ORGANIZATION_PERMISSIONS.VIEW_REPORTS);
export const viewFinanceValidator = organizationPermissionValidator(ORGANIZATION_PERMISSIONS.VIEW_FINANCE);
export const manageOrganizationSettingsValidator = organizationPermissionValidator(
  ORGANIZATION_PERMISSIONS.MANAGE_ORGANIZATION_SETTINGS
);
export const manageBillingValidator = organizationPermissionValidator(
  ORGANIZATION_PERMISSIONS.MANAGE_BILLING
);
export const manageUsersValidator = organizationPermissionValidator(
  ORGANIZATION_PERMISSIONS.MANAGE_USERS
);
export const manageTeamsValidator = organizationPermissionValidator(
  ORGANIZATION_PERMISSIONS.MANAGE_TEAMS
);
export const manageClientsValidator = organizationPermissionValidator(
  ORGANIZATION_PERMISSIONS.MANAGE_CLIENTS
);

const ADMIN_CENTER_ENTRY_PERMISSIONS: OrganizationPermission[] = [
  ORGANIZATION_PERMISSIONS.MANAGE_USERS,
  ORGANIZATION_PERMISSIONS.MANAGE_TEAMS,
  ORGANIZATION_PERMISSIONS.MANAGE_BILLING,
  ORGANIZATION_PERMISSIONS.MANAGE_ORGANIZATION_SETTINGS,
];

/** Owner/Admin, or any Manage permission that unlocks Admin Center. */
export const adminCenterAccessValidator = async (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> => {
  try {
    if (isOwnerOrAdmin(req)) return next();
    for (const permission of ADMIN_CENTER_ENTRY_PERMISSIONS) {
      if (await hasOrganizationPermission(req.user, permission)) return next();
    }
    return sendForbidden(res);
  } catch (error) {
    return next(error);
  }
};

/** Changes on surfaces opened read-only through "View ..." permissions stay Owner/Admin-only. */
export const ownerOrAdminWriteValidator = (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): IWorkLenzResponse | void => {
  if (isOwnerOrAdmin(req)) return next();
  return sendForbidden(res);
};

/** Client Portal management: reads need "View clients", writes need "Manage clients". */
export const clientsReadOnlyValidator = async (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): Promise<IWorkLenzResponse | void> => {
  if (!READ_METHODS.includes(req.method)) {
    return manageClientsValidator(req, res, next);
  }
  return organizationPermissionValidator(ORGANIZATION_PERMISSIONS.VIEW_CLIENTS)(req, res, next);
};
