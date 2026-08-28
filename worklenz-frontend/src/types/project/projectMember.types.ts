export interface IProjectMember {
  id?: string;
  team_member_id?: string;
  project_access_level_id?: string;
  project_id?: string;
  access_level?: string; // The access level name: ADMIN, MEMBER, PROJECT_MANAGER, GUEST
}

export interface IProjectMemberInviteRequest {
  email: string;
  project_id: string;
  access_level?: "ADMIN" | "MEMBER" | "PROJECT_MANAGER" | "GUEST"; // Default: MEMBER
}

