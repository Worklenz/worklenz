import {Injectable} from '@angular/core';
import {lastValueFrom} from "rxjs";
import {HttpClient} from "@angular/common/http";

import {APIServiceBase} from "./api-service-base";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IJobTitle} from "@interfaces/job-title";
import {IJobTitlesViewModel} from "@interfaces/api-models/job-titles-view-model";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class JobTitlesApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/job-titles`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: IJobTitle): Promise<IServerResponse<IJobTitle>> {
    return this._post(this.http, this.root, body);
  }

  get(index: number, size: number, field: string | null, order: string | null, search: string | null): Promise<IServerResponse<IJobTitlesViewModel>> {
    const s = encodeURIComponent(search || '');
    const url = `${this.root}${toQueryString({index, size, field, order, search: s})}`;
    return this._get(this.http, url);
  }

  getById(id: string): Promise<IServerResponse<IJobTitle>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  update<T>(id: string, body: IJobTitle): Promise<IServerResponse<IJobTitle>> {
    return this._put(this.http, `${this.root}/${id}`, body);
  }

  delete(id: string): Promise<IServerResponse<IJobTitle>> {
    return lastValueFrom(this.http.delete<IServerResponse<IJobTitle>>(`${this.root}/${id}`));
  }
}
