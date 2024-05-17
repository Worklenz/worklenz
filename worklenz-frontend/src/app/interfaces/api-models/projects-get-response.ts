import {IProject} from '../project';
import {ITeamMemberViewModel} from './team-members-get-response';
import {ITask} from '../task';
import {InlineMember} from "@interfaces/api-models/inline-member";

export interface IProjectsOverviewGetResponse extends IProject {
  client_name?: string;
  project_owner?: string;
  task_count?: number;
  members_count?: number;
  done_task_count?: number;
  pending_task_count?: number;
  progress?: number;
  all_tasks_count?: number;
  completed_tasks_count?: number;
  members?: ITeamMemberViewModel[];
  tasks?: ITask[];
  names?: Array<InlineMember>;
}
