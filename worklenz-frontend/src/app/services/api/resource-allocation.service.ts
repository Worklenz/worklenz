import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";

import {APIServiceBase} from "@api/api-service-base";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IProjectWiseResourcesViewModel} from "@interfaces/project-wise-resources-view-model";
import {format} from "date-fns";


@Injectable({
  providedIn: 'root'
})
export class ResourceAllocationService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/resource-allocation`;

  constructor(private http: HttpClient) {
    super();
  }

  getProjectWiseResources(week: { start: Date, end: Date }): Promise<IServerResponse<IProjectWiseResourcesViewModel>> {
    return this._get(this.http, `${this.root}/project?start=${format(week.start, 'yyyy-MM-dd')}&end=${format(week.end, 'yyyy-MM-dd')}`);
  }

  getUserWiseResources(week: { start: Date, end: Date }): Promise<IServerResponse<IProjectWiseResourcesViewModel>> {
    return this._get(this.http, `${this.root}/team?start=${format(week.start, 'yyyy-MM-dd')}&end=${format(week.end, 'yyyy-MM-dd')}`);
  }
}
