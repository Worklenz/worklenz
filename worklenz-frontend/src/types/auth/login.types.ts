import { ILocalSession } from './local-session.types';

export interface IUser {
  id?: string;
  name?: string;
  password?: string;
  email?: string;
}

export interface IUserLoginRequest {
  email: string;
  password: string;
  team_id?: string;
  project_id?: string;
}

export interface IUserLoginResponse extends IUser {}

export interface IAuthorizeResponse {
  authenticated: boolean;
  user: ILocalSession;
  auth_error: string;
  message: string;
}

export interface IAuthState {
  user: IUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  teamId?: string;
  projectId?: string;
}
