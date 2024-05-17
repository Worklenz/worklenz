import {Injectable} from '@angular/core';
import {lastValueFrom} from "rxjs";
import {HttpClient} from "@angular/common/http";

import {APIServiceBase} from "./api-service-base";
import {ITeamMemberCreateRequest} from "@interfaces/api-models/team-member-create-request";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITeamMember} from "@interfaces/team-member";
import {
  ITasksByTeamMembers,
  ITeamMemberOverviewByProjectGetResponse,
  ITeamMemberOverviewChartGetResponse,
  ITeamMemberTreeMap,
  ITeamMemberTreeMapResponse,
  ITeamMemberViewModel
} from "@interfaces/api-models/team-members-get-response";
import {toQueryString} from "@shared/utils";
import {ITeamMembersViewModel} from "@interfaces/api-models/team-members-view-model";

@Injectable({
  providedIn: 'root'
})
export class TeamMembersApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/team-members`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  public create<T>(body: ITeamMemberCreateRequest): Promise<IServerResponse<ITeamMember>> {
    return this._post(this.http, this.root, body);
  }

  public get(index: number, size: number, field: string | null, order: string | null, search: string | null, all = false): Promise<IServerResponse<ITeamMembersViewModel>> {
    const s = encodeURIComponent(search || '');
    const url = `${this.root}${toQueryString({index, size, field, order, search: s, all})}`;
    return this._get(this.http, url);
  }

  public getById(id: string): Promise<IServerResponse<ITeamMemberViewModel>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  public getAll(projectId: string | null = null): Promise<IServerResponse<ITeamMemberViewModel[]>> {
    const q = toQueryString({project: projectId});
    return this._get(this.http, `${this.root}/all${q}`);
  }

  public update<T>(id: string, body: ITeamMemberCreateRequest): Promise<IServerResponse<ITeamMember>> {
    return this._put(this.http, `${this.root}/${id}`, body);
  }

  public delete(id: string, email: string): Promise<IServerResponse<ITeamMemberViewModel>> {
    const q = toQueryString({email: email})
    return lastValueFrom(this.http.delete<IServerResponse<ITeamMemberViewModel>>(`${this.root}/${id}${q}`));
  }

  public getTeamMembersByProjectId(projectId: string): Promise<IServerResponse<ITeamMember[]>> {
    return this._get(this.http, `${this.root}/project/${projectId}`);
  }

  public resendInvitation(id: string): Promise<IServerResponse<ITeamMemberViewModel>> {
    return this._put(this.http, `${this.root}/resend-invitation`, {id});
  }

  public toggleMemberActiveStatus(id: string, active: boolean, email: string): Promise<IServerResponse<ITeamMemberViewModel>> {
    const q = toQueryString({active: active, email: email})
    return this._get(this.http, `${this.root}/deactivate/${id}${q}`);
  }

  public addTeamMember(id: string, body: ITeamMemberCreateRequest): Promise<IServerResponse<ITeamMemberViewModel>> {
    return this._put(this.http, `${this.root}/add-member/${id}`, body);
  }
}
