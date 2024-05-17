import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IProjectStatus} from "@interfaces/project-status";

@Injectable({
  providedIn: 'root'
})
export class ProjectStatusesApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/project-statuses`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  get(): Promise<IServerResponse<IProjectStatus[]>> {
    return this._get(this.http, this.root);
  }
}
