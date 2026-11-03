/**
 * Only Owner/Admin may create projects from templates.
 */

import { IPassportSession } from "../interfaces/passport-session";
import { hasTeamAdminPrivileges } from "./team-permissions";

export const userCanCreateProjectsFromTemplates = (
  user: IPassportSession | undefined | null
): boolean => {
  return Boolean(user && hasTeamAdminPrivileges(user));
};

/**
 * Keep the session flag consistent for legacy clients. It no longer grants
 * members access; authorization is based solely on the role check above.
 */
export const enrichSessionWithTemplateCreateAccess = async (
  user: IPassportSession
): Promise<void> => {
  user.can_create_projects_from_templates = hasTeamAdminPrivileges(user);
};
