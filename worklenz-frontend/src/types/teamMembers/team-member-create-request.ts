import { ITeamMember } from './teamMember.types';

export interface ITeamMemberCreateRequest extends ITeamMember {
  job_title?: string | null;
  department_id?: string | null;
  practice_id?: string | null;
  emails?: string | string[];
  is_admin?: boolean;
  is_guest?: boolean;
  role_name?: string; // Support for role selection (Admin, Team Lead, Member)
  /** Phase 5 — grant create-from-templates (Owner/Admin only). */
  can_create_projects_from_templates?: boolean;
}
