import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";

import {IAuthorizeResponse} from "@interfaces/api-models/authorize-response";
import {AppService} from "@services/app.service";
import {AuthService} from "@services/auth.service";
import {AuthApiService} from "@api/auth-api.service";
import {log_error} from "@shared/utils";
import {WORKLENZ_REDIRECT_PROJ_KEY} from "@shared/constants";

@Component({
  selector: 'worklenz-authenticate',
  templateUrl: './authenticate.component.html',
  styleUrls: ['./authenticate.component.scss'],
  standalone: true
})
export class AuthenticateComponent implements OnInit {

  constructor(
    private readonly api: AuthApiService,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly app: AppService
  ) {
    this.app.setTitle("Authenticating...");
  }

  async ngOnInit() {
    await this.authorize();
  }

  public async authorize() {
    try {
      const res: IAuthorizeResponse = await this.api.authorize();
      if (res.authenticated) {
        this.auth.setCurrentSession(res.user);
        this.handleSuccessRedirect();
        return;
      }
    } catch (e) {
      log_error(e);
    }

    await this.router.navigate(["/"]);
  }

  private handleSuccessRedirect() {
    const project = localStorage.getItem(WORKLENZ_REDIRECT_PROJ_KEY);
    if (project) {
      localStorage.removeItem(WORKLENZ_REDIRECT_PROJ_KEY);
      window.location.href = `/worklenz/projects/${project}`;
      return;
    }

    window.location.href = "/worklenz";
  }
}
