import { Params } from 'react-router-dom';
import { ITeamInvites } from '../teams/team.type';

export interface IWorklenzNotification {
  id: string;
  team: string;
  team_id: string;
  message: string;
  project?: string;
  color?: string;
  url?: string;
  task_id?: string;
  params?: Params;
  created_at?: string;
}

export interface ITeamInvitationViewModel extends ITeamInvites {
  accepting?: boolean;
  joining?: boolean;
}

export declare type NotificationsDataModel = Array<{
  type: 'invitation' | 'notification';
  data: ITeamInvitationViewModel | IWorklenzNotification;
}>;
