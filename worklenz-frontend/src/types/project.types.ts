import { CategoryType } from './categories.types';
import { IClient } from './client.types';
import { MemberType } from './member.types';

export type ProjectStatus =
  | 'cancelled'
  | 'blocked'
  | 'onHold'
  | 'proposed'
  | 'inPlanning'
  | 'inProgress'
  | 'completed'
  | 'continuous';

export type ProjectHealthStatus = 'notSet' | 'needsAttention' | 'atRisk' | 'good';

export type ProjectType = {
  projectId: string;
  projectName: string;
  projectColor: string;
  projectStatus: ProjectStatus;
  projectHealthStatus: ProjectHealthStatus;
  projectCategory?: CategoryType | null;
  projectNotes?: string | null;
  projectClient?: IClient[] | null;
  projectManager?: MemberType;
  projectStartDate?: Date | null;
  projectEndDate?: Date | null;
  projectEstimatedWorkingDays?: number;
  projectEstimatedManDays?: number;
  projectHoursPerDays?: number;
  projectCreated: Date;
  isFavourite: boolean;
  projectTeam: string;
  projectMemberCount: number;
};

export interface IProject {
  id?: string;
  name?: string;
  color_code?: string;
  notes?: string;
  team_id?: string;
  client_id?: string;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
  status_id?: string;
  man_days?: number;
  hours_per_day?: number;
}
