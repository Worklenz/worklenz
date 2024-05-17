import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {ITimeLogBreakdownReq} from "../../administrator/reporting/interfaces";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class ReportingExportApiService extends APIServiceBase {

  private readonly root = `${this.API_BASE_URL}/reporting-export`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  exportOverviewProjectsByTeam(teamId: string, teamName: string) {
    const params = toQueryString({
      team_id: teamId,
      team_name: teamName
    });
    window.location.href = `${this.root}/overview/projects${params}`;
  }

  exportOverviewMembersByTeam(teamId: string, teamName: string) {
    const params = toQueryString({
      team_id: teamId,
      team_name: teamName
    });
    window.location.href = `${this.root}/overview/members${params}`;
  }


  exportAllocation(archived: boolean, teams: string[], projects: string[], duration: string | undefined, date_range: string[]) {
    const teamsString = teams?.join(",");
    const projectsString = projects.join(",");
    window.location.href = `${this.root}/allocation/export${toQueryString({
      teams: teamsString,
      projects: projectsString,
      duration: duration,
      date_range: date_range,
      include_archived: archived
    })}`
  }

  exportProjects(teamName: string | undefined) {
    const params = toQueryString({
      team_name: teamName
    });
    window.location.href = `${this.root}/projects/export${params}`;
  }

  exportMembers(teamName: string | undefined, duration: string | null | undefined, date_range: string[] | null, archived: boolean) {
    const params = toQueryString({
      team_name: teamName,
      duration: duration,
      date_range: date_range,
      archived: archived
    });
    window.location.href = `${this.root}/members/export${params}`;
  }

  exportProjectMembers(projectId: string, projectName: string, teamName: string | null | undefined) {
    const params = toQueryString({
      project_id: projectId,
      project_name: projectName,
      team_name: teamName ? teamName : null
    });
    window.location.href = `${this.root}/project-members/export${params}`
  }

  exportProjectTasks(projectId: string, projectName: string, teamName: string | null | undefined) {
    const params = toQueryString({
      project_id: projectId,
      project_name: projectName,
      team_name: teamName ? teamName : null
    });
    window.location.href = `${this.root}/project-tasks/export${params}`
  }

  exportMemberProjects(memberId: string, teamId: string | null, memberName: string, teamName: string | null | undefined, archived: boolean) {
    const params = toQueryString({
      team_member_id: memberId,
      team_id: teamId,
      team_member_name: memberName,
      team_name: teamName ? teamName : null,
      archived: archived
    });
    window.location.href = `${this.root}/member-projects/export${params}`
  }

  exportMemberTasks(memberId: string, memberName: string, teamName: string | null | undefined, body: any | null) {
    const params = toQueryString({
      team_member_id: memberId,
      team_member_name: memberName,
      team_name: teamName ? teamName : null,
      duration: body.duration,
      date_range: body.date_range,
      only_single_member: body.only_single_member ? body.only_single_member : false,
      archived: body.archived ? body.archived : false
    });
    window.location.href = `${this.root}/member-tasks/export${params}`
  }

  exportFlatTasks(memberId: string, memberName: string, projectId: string | null, projectName: string | null) {
    const params = toQueryString({
      team_member_id: memberId,
      team_member_name: memberName,
      project_id: projectId,
      project_name: projectName
    });
    window.location.href = `${this.root}/flat-tasks/export${params}`
  }

  exportProjectTimeLogs(body: ITimeLogBreakdownReq, projectName: string) {
    const params = toQueryString({
      id: body.id,
      duration: body.duration,
      date_range: body.date_range,
      project_name: projectName
    })
    window.location.href = `${this.root}/projects-time-log-breakdown/export${params}`;
  }

  exportMemberTimeLogs(body: any | null) {
    const params = toQueryString({
      team_member_id: body.team_member_id,
      team_id: body.team_id,
      duration: body.duration,
      date_range: body.date_range,
      member_name: body.member_name,
      team_name: body.team_name,
      archived: body.archived ? body.archived : false
    });
    window.location.href = `${this.root}/member-time-log-breakdown/export${params}`
  }

  exportMemberActivityLogs(body: any | null) {
    const params = toQueryString({
      team_member_id: body.team_member_id,
      team_id: body.team_id,
      duration: body.duration,
      date_range: body.date_range,
      member_name: body.member_name,
      team_name: body.team_name,
      archived: body.archived ? body.archived : false
    });
    window.location.href = `${this.root}/member-activity-log-breakdown/export${params}`
  }

}
