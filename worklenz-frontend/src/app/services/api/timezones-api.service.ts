import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITimezone} from "@interfaces/timezone";

@Injectable({
  providedIn: 'root'
})
export class TimezonesApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/timezones`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  update<T>(body: any): Promise<IServerResponse<ITimezone[]>> {
    return this._put(this.http, this.root, body);
  }

  get<T>(): Promise<IServerResponse<ITimezone[]>> {
    return this._get(this.http, this.root);
  }

}
