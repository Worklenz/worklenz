import {Injectable} from '@angular/core';
import {IServerResponse} from "@interfaces/api-models/server-response";
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IActivityLogsResponse} from "@interfaces/api-models/activity-logs-get-response";

@Injectable({
  providedIn: 'root'
})
export class ActivityLogsService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/activity-logs`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  getActivityLogs(task_id: string): Promise<IServerResponse<IActivityLogsResponse>> {
    return this._get(this.http, `${this.root}/${task_id}`);
  }
}
