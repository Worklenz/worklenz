import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {APIServiceBase} from "@api/api-service-base";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IProjectCategory} from "@interfaces/project-category";
import {IProjectManager} from "@interfaces/project-manager";

@Injectable({
  providedIn: 'root'
})
export class ProjectManagersApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/project-managers`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  get(): Promise<IServerResponse<IProjectManager[]>> {
    return this._get(this.http, `${this.root}`);
  }

}
