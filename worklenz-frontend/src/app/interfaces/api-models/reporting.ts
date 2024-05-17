import {
  IReportingMemberCurrentlyDoing,
  IReportingMemberOverdueTask,
  IReportingMemberProjectTaskLate,
  IReportingMemberRecentLogged,
  IReportingProjectsCustom
} from "@interfaces/reporting";

export interface IReportingProjectsCustomGetResponse {
  total?: number;
  data?: IReportingProjectsCustom[]
}

export interface IReportingMemberOverviewGetRequest {
  logged_tasks?: IReportingMemberRecentLogged[];
  current_tasks?: IReportingMemberCurrentlyDoing[];
  overdue_tasks?: IReportingMemberOverdueTask[];
}

export interface IReportingMemberProjectResponse {
  overloggedTasks: IReportingMemberProjectTaskLate[];
  earlyTasks: IReportingMemberProjectTaskLate[];
  lateTasks: IReportingMemberProjectTaskLate[];
}
