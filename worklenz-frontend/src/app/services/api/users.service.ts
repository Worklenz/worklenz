import {Injectable} from '@angular/core';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {ITeam} from '@interfaces/team';
import {HttpClient} from '@angular/common/http';
import {APIServiceBase} from '@api/api-service-base';

@Injectable({
  providedIn: 'root'
})
export class UsersService extends APIServiceBase {
  constructor(
    private http: HttpClient
  ) {
    super();
  }

  public changePassword<T>(body: {
    password: any;
    new_password: any;
    confirm_password: any
  }): Promise<IServerResponse<ITeam>> {
    return this._post(this.http, `${this.API_BASE_URL}/change-password`, body);
  }
}
