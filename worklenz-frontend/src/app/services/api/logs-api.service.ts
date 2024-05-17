import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IActivityLog} from "@interfaces/personal-overview";

@Injectable({
  providedIn: 'root'
})
export class LogsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/logs`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  getActivityLog(): Promise<IServerResponse<IActivityLog[]>> {
    return this._get(this.http, `${this.root}/my-dashboard`);
  }
}
