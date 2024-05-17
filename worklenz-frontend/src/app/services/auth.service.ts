import {Injectable} from '@angular/core';
import {Router} from "@angular/router";
import {IAuthorizeResponse} from "@interfaces/api-models/authorize-response";
import {AuthApiService} from "@api/auth-api.service";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {log_error} from "@shared/utils";
import {deleteSession, getSession, hasSession, setSession} from "@shared/session-helper";
import {NzModalService} from "ng-zorro-antd/modal";

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public get role() {
    const user = this.getCurrentSession();
    if (!user) return 'Unknown';
    if (user.owner) return 'Owner';
    if (user.is_admin) return 'Admin';
    return 'Member';
  }

  constructor(
    private readonly router: Router,
    private readonly api: AuthApiService,
    private readonly modal: NzModalService
  ) {
  }

  public isAuthenticated(): boolean {
    return !!this.getCurrentSession();
  }

  public setCurrentSession(user: ILocalSession): void {
    setSession(user);
  }

  public getCurrentSession(): ILocalSession | null {
    return getSession();
  }

  public isOwnerOrAdmin() {
    return !!(this.getCurrentSession()?.owner || this.getCurrentSession()?.is_admin);
  }

  public async signOut() {
    try {
      if (hasSession()) {
        deleteSession();
        await this.api.logout();
      }
    } catch (e) {
      // ignored
    }
  }

  private onSignOutConfirm() {
    void this.signOut();
    window.location.href = "/secure/logout";
  }

  public signOutWithConfirm() {
    this.modal.confirm({
      nzTitle: 'Sign out from the Worklenz?',
      nzOnOk: () => {
        this.onSignOutConfirm();
      }
    });
  }

  public async authorize() {
    try {
      const res: IAuthorizeResponse = await this.api.authorize();
      if (res.authenticated) {
        this.setCurrentSession(res.user);
        return true;
      }
      await this.signOut();
    } catch (e) {
      log_error(e);
      await this.signOut();
    }
    return false;
  }
}

