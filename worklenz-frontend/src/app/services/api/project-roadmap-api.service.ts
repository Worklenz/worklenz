import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITaskListConfigV2, ITaskListGroup} from "../../administrator/modules/task-list-v2/interfaces";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {toQueryString} from "@shared/utils";
import {IDateCreateResponse} from "@interfaces/workload";
import {IRoadmapConfigV2} from "@interfaces/roadmap";

@Injectable({
  providedIn: 'root'
})
export class ProjectRoadmapApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/roadmap-gannt`;

  constructor(private http: HttpClient) {
    super();
  }

  getGanntDates(id: string, timeZone: string): Promise<IServerResponse<IDateCreateResponse>> {
    const q = toQueryString({timeZone: timeZone})
    return this._get(this.http, `${this.root}/chart-dates/${id}${q}`);
  }

  getTaskGroups(config: IRoadmapConfigV2): Promise<IServerResponse<ITaskListGroup[] | IProjectTask[]>> {
    const q = toQueryString(config);
    return this._get(this.http, `${this.root}/task-groups/${config.id}${q}`);
  }

}
