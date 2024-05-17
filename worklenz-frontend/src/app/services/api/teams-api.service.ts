import {Injectable} from '@angular/core';
import {APIServiceBase} from './api-service-base';
import {HttpClient} from '@angular/common/http';
import {lastValueFrom} from 'rxjs';

import {IProjectCreateRequest} from '@interfaces/api-models/project-create-request';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {IAcceptTeamInvite, ITeam, ITeamInvites} from '@interfaces/team';
import {ITeamActivateResponse} from '@interfaces/api-models/team-activate-response';
import {ITeamGetResponse} from "@interfaces/api-models/team-get-response";

@Injectable({
  providedIn: 'root',
})
export class TeamsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/teams`;

  constructor(private http: HttpClient) {
    super();
  }

  create<T>(body: IProjectCreateRequest): Promise<IServerResponse<ITeam>> {
    return this._post(this.http, this.root, body);
  }

  get(): Promise<IServerResponse<ITeamGetResponse[]>> {
    return this._get(this.http, this.root);
  }

  getInvites(): Promise<IServerResponse<ITeamInvites[]>> {
    return this._get(this.http, `${this.root}/invites`);
  }

  getById(id: string): Promise<IServerResponse<ITeam>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  update<T>(id: string, body: ITeam): Promise<IServerResponse<ITeam>> {
    return this._put(this.http, `${this.root}/${id}`, body);
  }

  setName<T>(name: string): Promise<IServerResponse<ITeam>> {
    return this._put(this.http, `${this.root}/pik-name`, {name});
  }

  activate<T>(id: string): Promise<IServerResponse<ITeamActivateResponse>> {
    return this._put(this.http, `${this.root}/activate`, {id});
  }

  accept<T>(body: IAcceptTeamInvite): Promise<IServerResponse<ITeamInvites>> {
    return this._put(this.http, this.root, body);
  }

  delete(id: string): Promise<IServerResponse<ITeam>> {
    return lastValueFrom(this.http.delete<IServerResponse<ITeam>>(`${this.root}/${id}`));
  }
}
