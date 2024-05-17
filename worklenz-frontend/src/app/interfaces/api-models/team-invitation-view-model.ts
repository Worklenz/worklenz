import {ITeamInvites} from "@interfaces/team";

export interface ITeamInvitationViewModel extends ITeamInvites {
  accepting?: boolean;
  joining?: boolean;
}
