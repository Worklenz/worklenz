import {ITaskAssignmentModelTeam} from "./task-assignments-model";

export interface IDailyDigest {
  name?: string;
  greeting?: string;
  note?: string;
  email?: string;
  base_url?: string;
  settings_url?: string;
  recently_assigned?: ITaskAssignmentModelTeam[];
  overdue?: ITaskAssignmentModelTeam[];
  recently_completed?: ITaskAssignmentModelTeam[];
}
