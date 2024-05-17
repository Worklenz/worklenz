import {Injectable} from '@angular/core';
import {IServerResponse} from "@interfaces/api-models/server-response";
import {HttpClient} from "@angular/common/http";
import {APIServiceBase} from "@api/api-service-base";
import {
  IActualVsEstimateGetRequest,
  IReportingActiveProject,
  IReportingEstimatedVsLogged,
  IReportingMemberProjects,
  IReportingMemberProjectTask,
  IReportingMemberStats,
  IReportingOverdueMembers,
  IReportingOverdueProject,
  IReportingOverview,
  IReportingProject,
  IReportingProjectStats,
  IReportingTeam,
  IReportingUnassignedMembers
} from "@interfaces/reporting";
import {ISelectableTeam} from "@interfaces/selectable-team";
import {ISelectableProject} from "@interfaces/selectable-project";
import {IAllocationViewModel} from "@interfaces/allocation-view-model";
import {toQueryString} from "@shared/utils";
import {
  IReportingMemberOverviewGetRequest,
  IReportingMemberProjectResponse,
  IReportingProjectsCustomGetResponse
} from "@interfaces/api-models/reporting";
import {ITeamMemberTreeMapResponse} from "@interfaces/api-models/team-members-get-response";

@Injectable({
  providedIn: 'root'
})
export class ReportingApiV0Service extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/reporting`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  getReportingOverview(includeArchived: boolean = false): Promise<IServerResponse<IReportingOverview>> {
    return this._get(this.http, `${this.root}/overview?includeArchived=${includeArchived}`);
  }

  getEstimatedVsLogged(includeArchived: boolean = false): Promise<IServerResponse<IReportingEstimatedVsLogged>> {
    return this._get(this.http, `${this.root}/estimated-vs-logged?includeArchived=${includeArchived}`);
  }

  getTeamsList(includeArchived: boolean = false): Promise<IServerResponse<IReportingTeam[]>> {
    return this._get(this.http, `${this.root}/teams?includeArchived=${includeArchived}`);
  }

  getProjectsByTeam(teamId: string, includeArchived: boolean = false): Promise<IServerResponse<IReportingProject[]>> {
    return this._get(this.http, `${this.root}/projects-by-team?id=${teamId}&includeArchived=${includeArchived}`);
  }

  getEstimatedVsActual(obj: {}): Promise<IServerResponse<IActualVsEstimateGetRequest>> {
    return this._post(this.http, `${this.root}/actual-vs-estimate`, obj);
  }

  getAllocation(body = {}, archived = false): Promise<IServerResponse<IAllocationViewModel>> {
    const q = toQueryString({archived});
    return this._post(this.http, `${this.root}/allocation${q}`, body);
  }

  getAllocationTeams(): Promise<IServerResponse<ISelectableTeam[]>> {
    return this._get(this.http, `${this.root}/allocation/teams`);
  }

  getAllocationProjects(selectedTeams: string[]): Promise<IServerResponse<ISelectableProject[]>> {
    return this._post(this.http, `${this.root}/allocation/projects`, selectedTeams);
  }

  exportOverviewExcel(includeArchived = false) {
    window.location.href = `${this.root}/overview/export?includeArchived=${includeArchived}`;
  }

  exportAllocationExcel(teams: string[], projects: string[], duration: string | null, date_range: any, includeArchived: boolean) {
    const teamsString = teams?.join(",");
    const projectsString = projects?.join(",");
    window.location.href = `${this.root}/allocation/export${toQueryString({
      teams: teamsString,
      projects: projectsString,
      duration,
      date_range,
      includeArchived
    })}`;
  }

  exportMembers(team: string, search: string | null, all = false, projects: string[] | null, status: string[] | null, duration: string | null, dateRange: any) {
    const projectsString = projects?.join(",");
    const statusString = status?.join(",");
    const range: string = dateRange?.join(",");
    window.location.href = `${this.root}/members/export${toQueryString({
      team,
      search,
      all,
      dateRange: range,
      projects: projectsString,
      status: statusString,
      duration
    })}`;
  }

  // Projects Reporting APIs
  getReportingProjectStats(includeArchived: boolean = false): Promise<IServerResponse<IReportingProjectStats>> {
    return this._get(this.http, `${this.root}/projects/stats?includeArchived=${includeArchived}`);
  }

  getReportingActiveProjects(includeArchived: boolean = false): Promise<IServerResponse<IReportingActiveProject[]>> {
    return this._get(this.http, `${this.root}/projects/active?includeArchived=${includeArchived}`);
  }

  getReportingOverdueProjects(includeArchived: boolean = false): Promise<IServerResponse<IReportingOverdueProject[]>> {
    return this._get(this.http, `${this.root}/projects/overdue?includeArchived=${includeArchived}`);
  }

  getProjectsCustom(body = {}, includeArchived = false, index: number, size: number, search: string): Promise<IServerResponse<IReportingProjectsCustomGetResponse>> {
    const q = toQueryString({includeArchived, index, size, search});
    return this._post(this.http, `${this.root}/projects/custom${q}`, body);
  }

  getDetails(projectId: string): Promise<IServerResponse<IReportingProject>> {
    return this._get(this.http, `${this.root}/project/${projectId}`);
  }

  exportProjectsExcel(teams: string[], status: string[], duration: string | null, date_range: any, includeArchived: boolean, search: string) {
    const s = encodeURIComponent(search || '');
    const teamsString = teams?.join(",");
    const statusString = status?.join(",");
    window.location.href = `${this.root}/projects/export${toQueryString({
      teams: teamsString,
      status: statusString,
      duration,
      date_range,
      includeArchived,
      search: s
    })}`;
  }

  //   Members
  getTeamMemberList(body = {}): Promise<IServerResponse<IReportingProjectsCustomGetResponse>> {
    return this._post(this.http, `${this.root}/members/all`, body);
  }

  getUnassignedMembers(): Promise<IServerResponse<IReportingUnassignedMembers[]>> {
    return this._get(this.http, `${this.root}/members/unassigned`);
  }

  getOverdueMembers(teamId: string): Promise<IServerResponse<IReportingOverdueMembers[]>> {
    return this._get(this.http, `${this.root}/members/overdue/${teamId}`);
  }

  getReportingMemberStats(memberId: string): Promise<IServerResponse<IReportingMemberStats>> {
    return this._get(this.http, `${this.root}/member/stats/${memberId}`);
  }

  getReportingMemberOverview(memberId: string): Promise<IServerResponse<IReportingMemberOverviewGetRequest>> {
    return this._get(this.http, `${this.root}/member/overview/${memberId}`);
  }

  getReportingMemberProjects(memberId: string, teamId: string): Promise<IServerResponse<IReportingMemberProjects[]>> {
    const params = toQueryString({memberId, teamId});
    return this._get(this.http, `${this.root}/member/projects${params}`);
  }

  getTasksByProject(memberId: string, projectId: string): Promise<IServerResponse<IReportingMemberProjectTask[]>> {
    const params = toQueryString({memberId, projectId});
    return this._get(this.http, `${this.root}/member/project${params}`);
  }

  getReportingMemberTasks(memberId: string, teamId: string): Promise<IServerResponse<IReportingMemberProjectResponse>> {
    const params = toQueryString({memberId, teamId});
    return this._get(this.http, `${this.root}/member/tasks${params}`);
  }

  getAllProjects(teamId: string): Promise<IServerResponse<IReportingOverdueMembers[]>> {
    return this._get(this.http, `${this.root}/projects/all/${teamId}`);
  }

  async getProjectsByTeamMember(body: any): Promise<IServerResponse<ITeamMemberTreeMapResponse>> {
    const url = `${this.root}/projects-by-member`;
    return this._post(this.http, url, body);
  }
}
