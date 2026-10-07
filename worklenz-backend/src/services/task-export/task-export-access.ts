/**
 * Pure permission decision for Task Export (TE-19 / TE-33).
 * Middleware loads managers / team-lead flags, then calls this.
 */
export interface TaskExportAccessUser {
  owner?: boolean;
  is_admin?: boolean;
  team_member_id?: string | null;
}

export const hasTaskExportPermission = (input: {
  user: TaskExportAccessUser | null | undefined;
  projectManagerTeamMemberId?: string | null;
  isTeamLeadMember?: boolean;
}): boolean => {
  const { user } = input;
  if (!user) return false;
  if (user.owner || user.is_admin) return true;
  if (
    input.projectManagerTeamMemberId &&
    user.team_member_id &&
    input.projectManagerTeamMemberId === user.team_member_id
  ) {
    return true;
  }
  if (input.isTeamLeadMember) return true;
  return false;
};
