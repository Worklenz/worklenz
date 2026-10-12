import { Params } from 'react-router-dom';
import { ITeamInvites } from '../teams/team.type';

export interface IWorklenzNotification {
  id: string;
  team: string;
  team_id: string;
  message: string;
  message_key?: string;
  message_params?: Record<string, any>;
  notification_type_key?: string;
  project?: string;
  color?: string;
  url?: string;
  task_id?: string;
  comment_id?: string;
  params?: Params;
  created_at?: string;
  release_id?: string;
}

export interface ITeamInvitationViewModel extends ITeamInvites {
  accepting?: boolean;
  joining?: boolean;
}

export declare type NotificationsDataModel = Array<{
  type: 'invitation' | 'notification';
  data: ITeamInvitationViewModel | IWorklenzNotification;
}>;
