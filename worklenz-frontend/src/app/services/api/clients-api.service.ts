import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {lastValueFrom} from "rxjs";

import {APIServiceBase} from "./api-service-base";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IClient} from "@interfaces/client";
import {IClientsViewModel} from "@interfaces/api-models/clients-view-model";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class ClientsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/clients`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: IClient): Promise<IServerResponse<IClient>> {
    return this._post(this.http, this.root, body);
  }

  get(index: number, size: number, field: string | null, order: string | null, search: string | null): Promise<IServerResponse<IClientsViewModel>> {
    const s = encodeURIComponent(search || '');
    return this._get(this.http, `${this.root}${toQueryString({index, size, field, order, search: s})}`);
  }

  getById(id: string): Promise<IServerResponse<IClient>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  update<T>(id: string, body: IClient): Promise<IServerResponse<IClient>> {
    return this._put(this.http, `${this.root}/${id}`, body);
  }

  delete(id: string): Promise<IServerResponse<IClient>> {
    return lastValueFrom(this.http.delete<IServerResponse<IClient>>(`${this.root}/${id}`));
  }
}
