import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {toQueryString} from "@shared/utils";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITaskLabel} from "@interfaces/task-label";

@Injectable({
  providedIn: 'root'
})
export class PtLabelsApiService extends APIServiceBase {
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

}
