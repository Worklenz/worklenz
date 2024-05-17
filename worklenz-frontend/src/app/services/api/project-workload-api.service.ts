import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {
  IDateCreateResponse,
  IWLMember,
  IWLMemberOverview, IWLMemberOverviewResponse,
  IWLTaskListGroup,
  IWLTasksConfig
} from "@interfaces/workload";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class ProjectWorkloadApiService extends APIServiceBase {

  private readonly root = `${this.API_BASE_URL}/workload-gannt`;

  constructor(private http: HttpClient) {
    super();
  }

  getGanntDates(id: string, timeZone: string): Promise<IServerResponse<IDateCreateResponse>> {
    const q = toQueryString({timeZone: timeZone})
    return this._get(this.http, `${this.root}/chart-dates/${id}${q}`);
  }

  getWorkloadMembers(project_id: string, timeZone: string): Promise<IServerResponse<IWLMember[]>> {
    const q = toQueryString({timeZone: timeZone})
    return this._get(this.http, `${this.root}/workload-members/${project_id}${q}`);
  }

  getTasksByMember(config: IWLTasksConfig): Promise<IServerResponse<IWLTaskListGroup[] | IProjectTask[]>> {
    const q = toQueryString(config);
    return this._get(this.http, `${this.root}/workload-tasks-by-member/${config.id}${q}`);
  }

  getMemberOverview(project_id: string, team_member_id: string): Promise<IServerResponse<IWLMemberOverviewResponse>> {
    const q = toQueryString({team_member_id})
    return this._get(this.http, `${this.root}/workload-overview-by-member/${project_id}${q}`);
  }

}
