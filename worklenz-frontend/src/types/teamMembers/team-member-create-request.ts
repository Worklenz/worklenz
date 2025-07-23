import { ITeamMember } from './teamMember.types';

export interface ITeamMemberCreateRequest extends ITeamMember {
  job_title?: string | null;
  emails?: string | string[];
  is_admin?: boolean;
  is_guest?: boolean;
}
