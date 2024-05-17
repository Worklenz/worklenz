import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";

import {IServerResponse} from "@interfaces/api-models/server-response";
import {IProfileSettings} from "@interfaces/profile-settings";

import {APIServiceBase} from "@api/api-service-base";
import {ITeam} from "@interfaces/team";
import {
  IAccountSetupRequest,
  IAccountSetupResponse
} from "../../administrator/account-setup/account-setup/account-setup.component";
import {INotificationSettings} from "@interfaces/notification-settings";

@Injectable({
  providedIn: 'root'
})
export class ProfileSettingsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/settings`;

  constructor(private http: HttpClient) {
    super();
  }

  get(): Promise<IServerResponse<IProfileSettings>> {
    return this._get(this.http, `${this.root}/profile`);
  }

  update(body: IProfileSettings): Promise<IServerResponse<IProfileSettings>> {
    return this._put(this.http, `${this.root}/profile`, body);
  }

  getNotificationSettings(): Promise<IServerResponse<INotificationSettings>> {
    return this._get(this.http, `${this.root}/notifications`);
  }

  updateNotificationSettings(body: INotificationSettings): Promise<IServerResponse<INotificationSettings>> {
    return this._put(this.http, `${this.root}/notifications`, body);
  }

  public setupAccount<T>(body: IAccountSetupRequest): Promise<IServerResponse<IAccountSetupResponse>> {
    return this._post(this.http, `${this.root}/setup`, body);
  }

  updateTeamName(id: string, body: ITeam): Promise<IServerResponse<ITeam>> {
    return this._put(this.http, `${this.root}/team-name/${id}`, body);
  }

}
