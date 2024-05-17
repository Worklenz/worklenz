import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {toQueryString} from "@shared/utils";
import {
  IMemberTaskListGroup,
  IMemberUpdateResponse, IProjectUpdateResposne,
  IScheduleDateCreateResponse,
  IScheduleProject,
  IScheduleTasksConfig
} from "@interfaces/schedular";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";

@Injectable({
  providedIn: 'root'
})
export class ScheduleApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/schedule-gannt`;

  constructor(private http: HttpClient) {
    super();
  }

  getGanttDates(id: string, timeZone: string): Promise<IServerResponse<IScheduleDateCreateResponse>> {
    const q = toQueryString({timeZone: timeZone})
    return this._get(this.http, `${this.root}/chart-dates/${id}${q}`);
  }

  getProjects(id: string, timeZone: string): Promise<IServerResponse<IScheduleProject[]>> {
    const q = toQueryString({timeZone: timeZone})
    return this._get(this.http, `${this.root}/projects/${id}${q}`);
  }

  getMemberAllocation(projectId: string, teamMemberId: string, timeZone: string, isProjectRefresh: boolean): Promise<IServerResponse<IMemberUpdateResponse>> {
    const q = toQueryString({team_member_id: teamMemberId, timeZone: timeZone, isProjectRefresh: isProjectRefresh})
    return this._get(this.http, `${this.root}/project-member/${projectId}${q}`);
  }

  getMemberProjectAllocation(projectId: string, teamMemberId: string, timeZone: string, isProjectRefresh: boolean): Promise<IServerResponse<IMemberUpdateResponse>>  {
    const q = toQueryString({team_member_id: teamMemberId, timeZone: timeZone, isProjectRefresh: isProjectRefresh})
    return this._get(this.http, `${this.root}/refresh/project-indicator/${projectId}${q}`);
  }

  bulkDeleteMemberAllocations(ids: string[]) {
    return this._put(this.http, `${this.root}/bulk/delete-member-allocations`, ids);
  }

  getTasksByMember(config: IScheduleTasksConfig): Promise<IServerResponse<IMemberTaskListGroup[] | IProjectTask[]>> {
    const q = toQueryString(config);
    return this._get(this.http, `${this.root}/tasks-by-member/${config.id}${q}`);
  }

}
