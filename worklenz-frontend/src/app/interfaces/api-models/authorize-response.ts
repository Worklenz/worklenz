import {IUser} from "../user";

export interface IAuthorizeResponse {
  authenticated: boolean;
  user: IUser;
  auth_error: string;
  message: string;
}
