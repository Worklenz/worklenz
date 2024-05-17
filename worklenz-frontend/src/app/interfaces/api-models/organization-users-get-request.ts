import {IOrganizationUser} from "@interfaces/account-center";

export interface IOrganizationUsersGetRequest {
  total?: number;
  data?: IOrganizationUser[];
}
