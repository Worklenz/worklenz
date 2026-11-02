/**
 * Creating projects from templates is allowed for Owner/Admin, or anyone
 * granted "Create projects" in the default permission scheme.
 */

import { IPassportSession } from "../interfaces/passport-session";
import { hasTeamAdminPrivileges } from "./team-permissions";
import {
  hasOrganizationPermission,
  ORGANIZATION_PERMISSIONS,
} from "./organization-permissions";

export const userCanCreateProjectsFromTemplates = (
  user: IPassportSession | undefined | null
): boolean => {
  return Boolean(user && hasTeamAdminPrivileges(user));
};

export const userCanCreateProjectsFromTemplatesAsync = async (
  user: IPassportSession | undefined | null
): Promise<boolean> => {
  if (!user) return false;
  if (hasTeamAdminPrivileges(user)) return true;
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
