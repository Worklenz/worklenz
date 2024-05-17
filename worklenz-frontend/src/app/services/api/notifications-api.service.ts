import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IWorklenzNotification} from "@interfaces/worklenz-notification";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class NotificationsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/notifications`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  update<T>(id: string): Promise<IServerResponse<any>> {
    return this._put(this.http, `${this.root}/${id}`, null);
  }

  readAll<T>(): Promise<IServerResponse<any>> {
    return this._put(this.http, `${this.root}/read-all`, null);
  }

  get(filter: string): Promise<IServerResponse<IWorklenzNotification[]>> {
    const q = toQueryString({filter});
    return this._get(this.http, `${this.root}${q}`);
  }

  getUnreadCount(): Promise<IServerResponse<number>> {
    return this._get(this.http, `${this.root}/unread-count`);
  }

}
