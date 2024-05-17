import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IProjectStatus} from "@interfaces/project-status";
import {APIServiceBase} from "@api/api-service-base";
import {IProjectHealth} from "@interfaces/project-health";

@Injectable({
  providedIn: 'root'
})
export class ProjectHealthsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/project-healths`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  get(): Promise<IServerResponse<IProjectHealth[]>> {
    return this._get(this.http, this.root);
  }
}
