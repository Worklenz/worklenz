import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";

export interface ISharedProjectInfo {
  url?: string;
  created_by?: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SharedProjectsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/shared/projects`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: { project_id?: string; }): Promise<IServerResponse<ISharedProjectInfo>> {
    return this._post(this.http, this.root, body);
  }

  get<T>(projectId: string): Promise<IServerResponse<ISharedProjectInfo>> {
    return this._get(this.http, `${this.root}/${projectId}`);
  }

  delete<T>(projectId: string): Promise<IServerResponse<ISharedProjectInfo>> {
    return this._delete(this.http, `${this.root}/${projectId}`);
  }
}
