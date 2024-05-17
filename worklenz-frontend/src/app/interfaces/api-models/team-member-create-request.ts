import {ITeamMember} from "../team-member";

export interface ITeamMemberCreateRequest extends ITeamMember {
  job_title?: string | null;
  emails?: string | string [];
  is_admin?: boolean;
}
