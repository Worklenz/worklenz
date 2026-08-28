import {IPassportSession} from "../interfaces/passport-session";

export class AuthResponse {
  private authenticated = false;
  private user: IPassportSession | null = null;
  private title: string | null = null;
  private auth_error: string | null = null;
  private message: string | null = null;
  // Mirrors ServerResponse's `done` semantics so the frontend's global response
  // interceptor renders `message` as a success toast rather than an error toast.
  private done = false;

  constructor(title: string | null, authenticated: boolean, user: IPassportSession | null, auth_error: string | null, message: string | null) {
    this.title = title;
    this.authenticated = !!authenticated;
    this.user = user;
    this.auth_error = auth_error;
    this.message = message;
    this.done = !auth_error;
  }
}
