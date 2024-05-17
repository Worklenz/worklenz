import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IClient} from "@interfaces/client";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {
  IBillingAccountInfo,
  IBillingAccountStorage,
  IBillingChargesResponse,
  IBillingConfiguration,
  IBillingConfigurationCountry,
  IBillingModifier,
  IBillingTransaction,
  IOrganization,
  IOrganizationTeam,
  IOrganizationUser,
  IPricingPlans,
  IStorageInfo,
  IUpgradeSubscriptionPlanResponse
} from "@interfaces/account-center";
import {toQueryString} from "@shared/utils";
import {IOrganizationUsersGetRequest} from "@interfaces/api-models/organization-users-get-request";
import {IOrganizationTeamGetRequest} from "@interfaces/api-models/organization-team-get-request";

@Injectable({
  providedIn: 'root'
})
export class AccountCenterApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/admin-center`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  getOrganizationName(): Promise<IServerResponse<IOrganization>> {
    return this._get(this.http, `${this.root}/organization`);
  }

  getOrganizationAdmins(): Promise<IServerResponse<IOrganizationUser[]>> {
    return this._get(this.http, `${this.root}/organization/admins`);
  }

  updateOrganizationName<T>(body: IClient): Promise<IServerResponse<IOrganization>> {
    return this._put(this.http, `${this.root}/organization`, body);
  }

  updateOwnerContactNumber<T>(body: { contact_number: string }): Promise<IServerResponse<IOrganization>> {
    return this._put(this.http, `${this.root}/organization/owner/contact-number`, body);
  }

  getOrganizationUsers(index: number, size: number, field: string | null, order: string | null, search: string | null): Promise<IServerResponse<IOrganizationUsersGetRequest>> {
    const s = encodeURIComponent(search || '');
    return this._get(this.http, `${this.root}/organization/users${toQueryString({
      index,
      size,
      field,
      order,
      search: s
    })}`);
  }

  getOrganizationTeams(index: number, size: number, field: string | null, order: string | null, search: string | null): Promise<IServerResponse<IOrganizationTeamGetRequest>> {
    const s = encodeURIComponent(search || '');
    return this._get(this.http, `${this.root}/organization/teams${toQueryString({
      index,
      size,
      field,
      order,
      search: s
    })}`);
  }

  getOrganizationTeam(team_id: string): Promise<IServerResponse<IOrganizationTeam>> {
    return this._get(this.http, `${this.root}/organization/team/${team_id}`);
  }

  updateTeam(team_id: string, team_members: IOrganizationUser[]): Promise<IServerResponse<IOrganization>> {
    return this._put(this.http, `${this.root}/organization/team/${team_id}`, team_members);
  }

  deleteTeam(id: string): Promise<IServerResponse<any>> {
    return this._delete(this.http, `${this.root}/organization/team/${id}`);
  }

  removeTeamMember(team_member_id: string, team_id: string): Promise<IServerResponse<any>> {
    return this._put(this.http, `${this.root}/organization/team-member/${team_member_id}`, {teamId: team_id})
  }
}
