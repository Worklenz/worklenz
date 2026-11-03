/**
 * Creating projects from templates follows the same "Create projects" grant
 * as ordinary project creation. Owners always hold that permission.
 */

import { IPassportSession } from "../interfaces/passport-session";
import { isTeamOwner } from "./team-permissions";
import {
  hasOrganizationPermission,
  ORGANIZATION_PERMISSIONS,
} from "./organization-permissions";

/** Sync check: Owners only (Admins must use the async grant lookup). */
export const userCanCreateProjectsFromTemplates = (
  user: IPassportSession | undefined | null
): boolean => {
  return Boolean(user && isTeamOwner(user));
};

export const userCanCreateProjectsFromTemplatesAsync = async (
  user: IPassportSession | undefined | null
): Promise<boolean> => {
  if (!user) return false;
  return hasOrganizationPermission(user, ORGANIZATION_PERMISSIONS.CREATE_PROJECTS);
};

/**
 * Keep the session flag consistent for legacy clients.
 */
export const enrichSessionWithTemplateCreateAccess = async (
  user: IPassportSession
): Promise<void> => {
  user.can_create_projects_from_templates = await userCanCreateProjectsFromTemplatesAsync(user);
};
