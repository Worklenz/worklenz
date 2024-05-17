import {Injectable} from '@angular/core';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {HttpClient} from "@angular/common/http";

import {APIServiceBase} from "./api-service-base";
import {toQueryString} from "@shared/utils";
import {ITaskPhase} from "@interfaces/api-models/task-phase";

@Injectable({
  providedIn: 'root'
})
export class TaskPhasesApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/task-phases`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create(projectId: string, isProjectManager = false): Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({id: projectId, current_project_id: projectId})
    return this._post(this.http, `${this.root}${q}`, {});
  }

  get(projectId: string): Promise<IServerResponse<ITaskPhase[]>> {
    const q = toQueryString({id: projectId})
    return this._get(this.http, `${this.root}${q}`);
  }

  getById(id: string, projectId: string): Promise<IServerResponse<ITaskPhase[]>> {
    const q = toQueryString({id: projectId})
    return this._get(this.http, `${this.root}/${id}${q}`);
  }

  updateLabel(projectId: string, name: string, isProjectManager = false): Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({current_project_id: projectId})
    return this._put(this.http, `${this.root}/label/${projectId}${q}`, {name});
  }

  update(projectId: string, body: ITaskPhase, isProjectManager = false): Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({id: projectId, current_project_id: projectId})
    return this._put(this.http, `${this.root}/${body.id}${q}`, body);
  }

  updateColor(projectId: string, body: ITaskPhase) : Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({id: projectId, current_project_id: projectId})
    return this._put(this.http, `${this.root}/change-color/${body.id}${q}`, body);
  }

  updateSortOrder(body: {}, project_id: string) {
    const q = toQueryString({current_project_id: project_id})
    return this._put(this.http, `${this.root}/update-sort-order${q}`, body);
  }

  delete(id: string, projectId: string, isProjectManager = false): Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({id: projectId, current_project_id: projectId})
    return this._delete(this.http, `${this.root}/${id}${q}`);
  }
}
