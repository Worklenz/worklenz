import {Injectable} from '@angular/core';
import {ITaskLogViewModel} from '@interfaces/api-models/task-log-create-request';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {HttpClient} from '@angular/common/http';
import {APIServiceBase} from '@api/api-service-base';
import {toQueryString} from "@shared/utils";
import {time} from "html2canvas/dist/types/css/types/time";

@Injectable({
  providedIn: 'root'
})
export class TasksLogTimeService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/task-time-log`;

  constructor(private http: HttpClient) {
    super();
  }

  create<T>(body: ITaskLogViewModel, requestBody: {}): Promise<IServerResponse<ITaskLogViewModel>> {
    return this._post(this.http, this.root, requestBody);
  }

  getByTask(id: string, timeZone: string): Promise<IServerResponse<ITaskLogViewModel[]>> {
    return this._get(this.http, `${this.root}/task/${id}`);
  }

  exportExcel(id: string) {
    // const options = {
    //   responseType: "blob",
    //   observe: 'response'
    // };
    // return this._post(this.http, `${this.root}/export/${id}`, {}, options as any);
    window.location.href = `${this.root}/export/${id}`;
  }

  update(id: string, model: ITaskLogViewModel, requestBody: {}): Promise<IServerResponse<ITaskLogViewModel[]>> {
    return this._put(this.http, `${this.root}/${id}`, requestBody);
  }

  delete(id: string, taskId: string): Promise<IServerResponse<ITaskLogViewModel[]>> {
    return this._delete(this.http, `${this.root}/${id}?task=${taskId}`);
  }
}
