import {IPassportSession} from "../interfaces/passport-session";

export class AuthResponse {
  private authenticated = false;
  private user: IPassportSession | null = null;
  private title: string | null = null;
  private auth_error: string | null = null;
  private message: string | null = null;

  constructor(title: string | null, authenticated: boolean, user: IPassportSession | null, auth_error: string | null, message: string | null) {
    this.title = title;
    this.authenticated = !!authenticated;
    this.user = user;
    this.auth_error = auth_error;
    this.message = message;
  }
}
