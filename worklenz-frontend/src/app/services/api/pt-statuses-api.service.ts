import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {ITaskStatusCreateRequest} from "@interfaces/api-models/task-status-create-request";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITaskStatus} from "@interfaces/task-status";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {ITaskStatusUpdateModel} from "@interfaces/api-models/task-status-update-model";

@Injectable({
  providedIn: 'root'
})
export class PtStatusesApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/pt-statuses`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: ITaskStatusCreateRequest): Promise<IServerResponse<ITaskStatus>> {
    return this._post(this.http, this.root, body);
  }

  get<T>(id: string): Promise<IServerResponse<ITaskStatus[]>> {
    return this._get(this.http, `${this.root}?template_id=${id}`);
  }

  getById<T>(id: string): Promise<IServerResponse<ITaskStatus>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  getCategories<T>(): Promise<IServerResponse<ITaskStatusCategory[]>> {
    return this._get(this.http, `${this.root}/categories`);
  }

  update<T>(id: string, body: ITaskStatusUpdateModel): Promise<IServerResponse<ITaskStatus>> {
    return this._put(this.http, `${this.root}/${id}`, body);
  }

  updateName<T>(id: string, body: ITaskStatusUpdateModel): Promise<IServerResponse<ITaskStatus>> {
    return this._put(this.http, `${this.root}/name/${id}`, body);
  }

  delete<T>(id: string, projectId: string, replacingStatusId?: string): Promise<IServerResponse<ITaskStatus>> {
    return this._delete(this.http, `${this.root}/${id}?project=${projectId}&replace=${replacingStatusId || null}`);
  }
}
