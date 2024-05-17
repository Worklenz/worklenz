import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITaskPrioritiesGetResponse} from "@interfaces/api-models/task-priorities-get-response";
import {APIServiceBase} from "@api/api-service-base";

@Injectable({
  providedIn: 'root'
})
export class PtPrioritiesApiService extends APIServiceBase{
  private readonly root = `${this.API_BASE_URL}/task-priorities`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  get(): Promise<IServerResponse<ITaskPrioritiesGetResponse[]>> {
    return this._get(this.http, this.root);
  }

  getById<T>(id: string): Promise<IServerResponse<any>> {
    return this._get(this.http, `${this.root}/${id}`);
  }
}
