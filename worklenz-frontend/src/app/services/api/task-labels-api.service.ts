import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITaskLabel} from "@interfaces/task-label";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class TaskLabelsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/labels`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  get<T>(projectId: string | null = null): Promise<IServerResponse<ITaskLabel[]>> {
    const q = toQueryString({project: projectId});
    return this._get(this.http, `${this.root}${q}`);
  }

  getByTask<T>(id: string): Promise<IServerResponse<ITaskLabel[]>> {
    return this._get(this.http, `${this.root}/tasks/${id}`);
  }

  /** Returns labels that have only been assigned to at least one task. */
  getByProject<T>(projectId: string): Promise<IServerResponse<ITaskLabel[]>> {
    return this._get(this.http, `${this.root}/project/${projectId}`);
  }

  updateColor<T>(id: string, color: string): Promise<IServerResponse<ITaskLabel[]>> {
    return this._put(this.http, `${this.root}/tasks/${id}`, {color});
  }

  deleteById<T>(id: string): Promise<IServerResponse<void>> {
    return this._delete(this.http, `${this.root}/team/${id}`);
  }
}
