import {ITeamInvitationViewModel} from "@interfaces/api-models/team-invitation-view-model";
import {IWorklenzNotification} from "@interfaces/worklenz-notification";

export declare type NotificationsDataModel = Array<{
  type: 'invitation' | 'notification';
  data: ITeamInvitationViewModel | IWorklenzNotification;
}>;
