import {IUser} from "../user";

export interface IUserLoginRequest extends IUser {
  team_id?: string;
  project_id?: string;
}
