import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {
  IMemberProjectsResonse,
  IMemberTaskStatGroup, IMemberTaskStatGroupResonse,
  IProjectLogsBreakdown,
  IReportingInfo,
  IRPTMember,
  IRPTMemberProject, IRPTMemberResponse,
  IRPTMembersViewModel,
  IRPTOverviewMemberInfo,
  IRPTOverviewProjectInfo,
  IRPTOverviewProjectMember,
  IRPTOverviewStatistics,
  IRPTOverviewTeamInfo,
  IRPTProject,
  IRPTProjectsViewModel,
  IRPTReportingMemberTask,
  IRPTTeam,
  IRPTTimeMember,
  IRPTTimeProject, ISingleMemberActivityLogs, ISingleMemberLogs,
  ITimeLogBreakdownReq
} from "./interfaces";
import {ITaskListGroup} from "../modules/task-list-v2/interfaces";
import {toQueryString} from "@shared/utils";
import {ISelectableProject} from "@interfaces/selectable-project";
import {IAllocationViewModel} from "@interfaces/allocation-view-model";
import {ISelectableCategory} from "@interfaces/selectable-category";
import {IProject} from "@interfaces/project";

@Injectable({
  providedIn: 'root'
})
export class ReportingApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/reporting`;

  constructor(
    private readonly http: HttpClient
  ) {
    super();
  }

  getInfo(): Promise<IServerResponse<IReportingInfo>> {
    return this._get(this.http, `${this.root}/info`);
  }

  getOverviewStatistics(includeArchived = false): Promise<IServerResponse<IRPTOverviewStatistics>> {
    const q = toQueryString({archived: includeArchived});
    return this._get(this.http, `${this.root}/overview/statistics${q}`);
  }

  getOverviewTeams(includeArchived = true): Promise<IServerResponse<IRPTTeam[]>> {
    const q = toQueryString({archived: includeArchived});
    return this._get(this.http, `${this.root}/overview/teams${q}`);
  }

  getOverviewProjects(body: any | null = null): Promise<IServerResponse<IRPTProjectsViewModel>> {
    const q = toQueryString(body);
    return this._get(this.http, `${this.root}/overview/projects${q}`);
  }

  getOverviewProjectsByTeam(teamId: string, teamMemberId?: string): Promise<IServerResponse<IRPTProject[]>> {
    const q = toQueryString({member: teamMemberId || null});
    return this._get(this.http, `${this.root}/overview/projects/${teamId}${q}`);
  }

  getOverviewMembersByTeam(teamId: string, archived: boolean): Promise<IServerResponse<IRPTMember[]>> {
    const q = toQueryString({archived});
    return this._get(this.http, `${this.root}/overview/members/${teamId}${q}`);
  }

  getTeamInfo(teamId: string, archived = false): Promise<IServerResponse<IRPTOverviewTeamInfo>> {
    const q = toQueryString({archived});
    return this._get(this.http, `${this.root}/overview/team/info/${teamId}${q}`);
  }

  getProjectInfo(projectId: string): Promise<IServerResponse<IRPTOverviewProjectInfo>> {
    return this._get(this.http, `${this.root}/overview/project/info/${projectId}`);
  }

  getMemberInfo(body: any | null = null): Promise<IServerResponse<IRPTOverviewMemberInfo>> {
    const q = toQueryString(body);
    return this._get(this.http, `${this.root}/overview/member/info/${q}`);
  }

  getTeamMemberInfo(body: any | null = null): Promise<IServerResponse<IRPTOverviewMemberInfo>> {
    const q = toQueryString(body);
    return this._get(this.http, `${this.root}/overview/team-member/info/${q}`);
  }

  getProjectMembers(projectId: string): Promise<IServerResponse<IRPTOverviewProjectMember[]>> {
    return this._get(this.http, `${this.root}/overview/project/members/${projectId}`);
  }

  getTasks(projectId: string, groupBy: string): Promise<IServerResponse<ITaskListGroup[]>> {
    const q = toQueryString({group: groupBy})
    return this._get(this.http, `${this.root}/overview/project/tasks/${projectId}${q}`);
  }

  getTasksByMember(teamMemberId: string, projectId: string | null = null, isMultiple: boolean, teamId: string | null = null, additionalBody: any | null = null ): Promise<IServerResponse<IRPTReportingMemberTask[]>> {
    const q = toQueryString({project: projectId || null, is_multiple: isMultiple, teamId, only_single_member: additionalBody.only_single_member, duration: additionalBody.duration, date_range: additionalBody.date_range, archived: additionalBody.archived});
    return this._get(this.http, `${this.root}/overview/member/tasks/${teamMemberId}${q}`);
  }

  getProjects(body: any | null = null): Promise<IServerResponse<IRPTProjectsViewModel>> {
    const q = toQueryString(body);
    return this._get(this.http, `${this.root}/projects${q}`);
  }

  getProjectTimeLogs(body: ITimeLogBreakdownReq): Promise<IServerResponse<IProjectLogsBreakdown[]>> {
    return this._post(this.http, `${this.root}/project-timelogs`, body)
  }

  // Allocation APIs
  getCategories(selectedTeams: string[]): Promise<IServerResponse<ISelectableCategory[]>> {
    return this._post(this.http, `${this.root}/allocation/categories`, selectedTeams);
  }

  getAllocationProjects(selectedTeams: string[], categories: string[], isNoCategory: boolean): Promise<IServerResponse<ISelectableProject[]>> {
    const body = {
      selectedTeams: selectedTeams,
      selectedCategories: categories,
      noCategoryIncluded: isNoCategory
    }
    return this._post(this.http, `${this.root}/allocation/projects`, body);
  }

  getAllocationData(body = {}, archived = false): Promise<IServerResponse<IAllocationViewModel>> {
    const q = toQueryString({archived});
    return this._post(this.http, `${this.root}/allocation${q}`, body);
  }

  // Members APIs
  getMembers(body: any | null = null): Promise<IServerResponse<IRPTMemberResponse>> {
    const q = toQueryString(body);
    return this._get(this.http, `${this.root}/members${q}`);
  }

  getMemberProjects(body: any | null = null): Promise<IServerResponse<IRPTMemberProject[]>> {
    const q = toQueryString(body);
    return this._get(this.http, `${this.root}/member-projects${q}`);
  }

  getProjectTimeSheets(body = {}, archived = false): Promise<IServerResponse<IRPTTimeProject[]>> {
    const q = toQueryString({archived});
    return this._post(this.http, `${this.root}/time-reports/projects${q}`, body);
  }

  getProjectEstimatedVsActual(body = {}, archived = false): Promise<IServerResponse<IRPTTimeProject[]>> {
    const q = toQueryString({archived});
    return this._post(this.http, `${this.root}/time-reports/estimated-vs-actual${q}`, body);
  }

  getMemberTimeSheets(body = {}, archived = false): Promise<IServerResponse<IRPTTimeMember[]>> {
    const q = toQueryString({archived});
    return this._post(this.http, `${this.root}/time-reports/members${q}`, body);
  }

  getSingleMemberActivities(body: any | null = null): Promise<IServerResponse<ISingleMemberActivityLogs[]>> {
    return this._post(this.http, `${this.root}/members/single-member-activities`, body);
  }

  getSingleMemberTimeLogs(body: any | null = null): Promise<IServerResponse<ISingleMemberLogs[]>> {
    return this._post(this.http, `${this.root}/members/single-member-timelogs`, body);
  }

  getMemberTasksStats(body: any | null = null): Promise<IServerResponse<IMemberTaskStatGroupResonse>> {
    const q = toQueryString(body);
    return this._get(this.http, `${this.root}/members/single-member-task-stats${q}`);
  }

  getSingleMemberProjects(body: any | null = null): Promise<IServerResponse<IMemberProjectsResonse>> {
    const q = toQueryString(body);
    return this._get(this.http, `${this.root}/members/single-member-projects${q}`);
  }

}
