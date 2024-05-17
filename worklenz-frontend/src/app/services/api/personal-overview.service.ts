import {Injectable} from '@angular/core';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {HttpClient} from '@angular/common/http';

import {APIServiceBase} from './api-service-base';
import {IActivityLogGetRequest} from '@interfaces/api-models/activity-log';
import {ITasksOverview} from '@interfaces/personal-overview';

@Injectable({
  providedIn: 'root'
})
export class PersonalOverviewService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/personal-overview`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  getActivityLog(): Promise<IServerResponse<IActivityLogGetRequest>> {
    return this._get(this.http, this.root);
  }

  getTasksDueToday(): Promise<IServerResponse<IActivityLogGetRequest>> {
    return this._get(this.http, `${this.root}/tasks-due-today`);
  }

  getRemainingTasks(): Promise<IServerResponse<IActivityLogGetRequest>> {
    return this._get(this.http, `${this.root}/tasks-remaining`);
  }

  getTasksOverview(start_date: string, end_date: string): Promise<IServerResponse<ITasksOverview[]>> {
    return this._get(this.http, `${this.root}/tasks-overview?start_date=${start_date}&end_date=${end_date}`);
  }
}
