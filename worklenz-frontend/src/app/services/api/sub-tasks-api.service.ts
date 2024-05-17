import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ISubTask} from "@interfaces/sub-task";
import {IGanttDateRange} from "@interfaces/gantt-chart";
import {ITaskCreateRequest} from "@interfaces/api-models/task-create-request";

@Injectable({
  providedIn: 'root'
})
export class SubTasksApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/sub-tasks`;

  constructor(private http: HttpClient) {
    super();
  }

  get(parentTaskId: string): Promise<IServerResponse<ISubTask[]>> {
    return this._get(this.http, `${this.root}/${parentTaskId}`);
  }

  getSubTasksForRoadMap(parentTaskId: string, body: IGanttDateRange[]): Promise<IServerResponse<ISubTask[]>> {
    return this._post(this.http, `${this.root}/roadmap/${parentTaskId}`, body);
  }

  getNames(parentTaskId: string): Promise<IServerResponse<ISubTask[]>> {
    return this._get(this.http, `${this.root}/names/${parentTaskId}`);
  }

  update(body: ITaskCreateRequest, id: string) {
    return this._put(this.http, `${this.root}/${id}`, body);
  }
}
