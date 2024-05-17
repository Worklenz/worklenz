import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {
  IDeadlineTaskStats,
  IInsightTasks,
  IProjectInsightsGetRequest,
  IProjectLogs,
  IProjectMemberStats
} from "@interfaces/api-models/project-insights";

@Injectable({
  providedIn: 'root'
})
export class ProjectInsightsService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/project-insights`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  getProjectOverviewData(id: string, include_archived: boolean): Promise<IServerResponse<IProjectInsightsGetRequest>> {
    return this._get(this.http, `${this.root}/${id}?archived=${include_archived}`);
  }

  getLastUpdatedTasks(id: string, include_archived: boolean): Promise<IServerResponse<IInsightTasks[]>> {
    return this._get(this.http, `${this.root}/last-updated/${id}?archived=${include_archived}`);
  }

  getProjectLogs(id: string): Promise<IServerResponse<IProjectLogs[]>> {
    return this._get(this.http, `${this.root}/logs/${id}`);
  }

  getTaskStatusCounts(id: string, include_archived: boolean): Promise<IServerResponse<IProjectLogs[]>> {
    return this._get(this.http, `${this.root}/status-overview/${id}?archived=${include_archived}`);
  }

  getPriorityOverview(id: string, include_archived: boolean): Promise<IServerResponse<IProjectLogs[]>> {
    return this._get(this.http, `${this.root}/priority-overview/${id}?archived=${include_archived}`);
  }

  getOverdueTasks(id: string, include_archived: boolean): Promise<IServerResponse<IProjectLogs[]>> {
    return this._get(this.http, `${this.root}/overdue-tasks/${id}?archived=${include_archived}`);
  }

  getTasksCompletedEarly(id: string, include_archived: boolean): Promise<IServerResponse<IProjectLogs[]>> {
    return this._get(this.http, `${this.root}/early-tasks/${id}?archived=${include_archived}`);
  }

  getTasksCompletedLate(id: string, include_archived: boolean): Promise<IServerResponse<IProjectLogs[]>> {
    return this._get(this.http, `${this.root}/late-tasks/${id}?archived=${include_archived}`);
  }

  getMemberInsightAStats(id: string, include_archived: boolean): Promise<IServerResponse<IProjectMemberStats>> {
    return this._get(this.http, `${this.root}/members/stats/${id}?archived=${include_archived}`);
  }

  getMemberTasks(body: any): Promise<IServerResponse<IInsightTasks[]>> {
    return this._post(this.http, `${this.root}/members/tasks`, body);
  }

  getProjectDeadlineStats(id: string, include_archived: boolean): Promise<IServerResponse<IDeadlineTaskStats>> {
    return this._get(this.http, `${this.root}/deadline/${id}?archived=${include_archived}`);
  }

  getOverloggedTasks(id: string, include_archived: boolean): Promise<IServerResponse<IProjectLogs[]>> {
    return this._get(this.http, `${this.root}/overlogged-tasks/${id}?archived=${include_archived}`);
  }
}
