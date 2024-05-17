import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {ITaskStatusCreateRequest} from "@interfaces/api-models/task-status-create-request";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITaskStatus} from "@interfaces/task-status";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {ITaskStatusUpdateModel} from "@interfaces/api-models/task-status-update-model";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class TaskStatusesApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/statuses`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: ITaskStatusCreateRequest, currentProjectId: string): Promise<IServerResponse<ITaskStatus>> {
    const q = toQueryString({current_project_id: currentProjectId})
    return this._post(this.http, `${this.root}${q}`, body);
  }

  /**
   * Get statuses by project id
   * @param id Project Id
   */
  get<T>(id: string): Promise<IServerResponse<ITaskStatus[]>> {
    return this._get(this.http, `${this.root}?project=${id}`);
  }

  getById<T>(id: string): Promise<IServerResponse<ITaskStatus>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  getCategories<T>(): Promise<IServerResponse<ITaskStatusCategory[]>> {
    return this._get(this.http, `${this.root}/categories`);
  }

  update<T>(id: string, body: ITaskStatusUpdateModel, currentProjectId: string): Promise<IServerResponse<ITaskStatus>> {
    const q = toQueryString({current_project_id: currentProjectId})
    return this._put(this.http, `${this.root}/${id}${q}`, body);
  }

  updateName<T>(id: string, body: ITaskStatusUpdateModel, currentProjectId: string): Promise<IServerResponse<ITaskStatus>> {
    const q = toQueryString({current_project_id: currentProjectId})
    return this._put(this.http, `${this.root}/name/${id}${q}`, body);
  }

  updateStatus<T>(id: string, body: ITaskStatusCreateRequest, currentProjectId: string): Promise<IServerResponse<ITaskStatus>> {
    const q = toQueryString({current_project_id: currentProjectId})
    return this._put(this.http, `${this.root}/order${q}`, body);
  }

  delete<T>(id: string, projectId: string, replacingStatusId?: string): Promise<IServerResponse<ITaskStatus>> {
    return this._delete(this.http, `${this.root}/${id}?project=${projectId}&current_project_id=${projectId}&replace=${replacingStatusId || null}`);
  }
}
