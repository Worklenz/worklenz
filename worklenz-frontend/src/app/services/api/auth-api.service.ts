import {Injectable} from '@angular/core';
import {lastValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';

import {APIServiceBase} from './api-service-base';
import {IUserLoginRequest} from '@interfaces/api-models/user-login-request';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {IUserLoginResponse} from '@interfaces/api-models/user-login-response';
import {IUserSignUpRequest} from '@interfaces/api-models/user-sign-up-request';
import {IAuthorizeResponse} from '@interfaces/api-models/authorize-response';
import {IResetPasswordRequest} from '@interfaces/api-models/reset-password-request';
import {IUpdatePasswordRequest} from "@interfaces/api-models/verify-reset-email";
import {IPasswordValidityResult} from "@interfaces/password-validity-result";

@Injectable({
  providedIn: 'root'
})
export class AuthApiService extends APIServiceBase {
  constructor(
    private http: HttpClient
  ) {
    super();
  }

  public login<T>(body: IUserLoginRequest): Promise<IServerResponse<IUserLoginResponse>> {
    return this._post(this.http, `${this.AUTH_API_BASE_URL}/login`, body);
  }

  public signup<T>(body: IUserSignUpRequest): Promise<IAuthorizeResponse> {
    body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return lastValueFrom(this.http.post<IAuthorizeResponse>(`${this.AUTH_API_BASE_URL}/signup`, body));
  }

  public signupCheck<T>(body: IUserSignUpRequest): Promise<IServerResponse<string>> {
    return this._post(this.http, `${this.AUTH_API_BASE_URL}/signup/check`, body);
  }

  public logout<T>(): Promise<IServerResponse<T>> {
    return this._get(this.http, `${this.AUTH_API_BASE_URL}/logout`);
  }

  public checkPasswordStrength(password: string): Promise<IServerResponse<IPasswordValidityResult>> {
    return this._get(this.http, `${this.AUTH_API_BASE_URL}/check-password?password=${password}`);
  }

  public authorize(): Promise<IAuthorizeResponse> {
    return lastValueFrom(this.http.get<IAuthorizeResponse>(`${this.AUTH_API_BASE_URL}/verify`));
  }

  public resetPassword<T>(body: IResetPasswordRequest): Promise<IServerResponse<string>> {
    return this._post(this.http, `${this.AUTH_API_BASE_URL}/reset-password`, body);
  }

  public updateNewPassword<T>(body: IUpdatePasswordRequest): Promise<IServerResponse<string>> {
    return this._post(this.http, `${this.AUTH_API_BASE_URL}/update-password`, body);
  }
}
