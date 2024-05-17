import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IGanttRoadMapTask} from "@interfaces/api-models/gantt";
import {IDateCreateResponse, ISingleMonth, IWLMember} from "@interfaces/workload";

@Injectable({
  providedIn: 'root'
})
export class TestGanntApiService extends APIServiceBase {

  private readonly root = `${this.API_BASE_URL}/workload-gannt`;

  constructor(private http: HttpClient) {
    super();
  }

  getGanntDates(id: string): Promise<IServerResponse<IDateCreateResponse>> {
    return this._get(this.http, `${this.root}/chart-dates/${id}`);
  }

  getWorkloadTasks(project_id: string, expanded_members: string[], orderByOn: boolean): Promise<IServerResponse<IWLMember[]>> {
    const body = {
      expanded_members: expanded_members,
      order_by_on: orderByOn
    }
    return this._post(this.http, `${this.root}/workload-tasks/${project_id}`, body);
  }

}
