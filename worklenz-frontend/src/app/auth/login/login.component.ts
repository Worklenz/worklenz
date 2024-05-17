import {AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';

import {AppService} from '@services/app.service';
import {IAuthorizeResponse} from '@interfaces/api-models/authorize-response';
import {AuthService} from '@services/auth.service';
import {AuthApiService} from '@api/auth-api.service';
import {log_error} from "@shared/utils";
import {WORKLENZ_REDIRECT_PROJ_KEY} from "@shared/constants";

@Component({
  selector: 'worklenz-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit {
  @ViewChild("emailInput") emailInput!: ElementRef<HTMLInputElement>;

  form!: FormGroup;

  validating = true;
  loading = false;
  passwordVisible = false;
  loadingGoogle = false;

  teamId: string | null = null;

  set projectId(value: string | null) {
    if (!value) {
      localStorage.removeItem(WORKLENZ_REDIRECT_PROJ_KEY);
      return;
    }
    localStorage.setItem(WORKLENZ_REDIRECT_PROJ_KEY, value);
  }

  get projectId() {
    return localStorage.getItem(WORKLENZ_REDIRECT_PROJ_KEY);
  }

  constructor(
    private readonly app: AppService,
    private readonly router: Router,
    private readonly api: AuthApiService,
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly ngZone: NgZone
  ) {
    this.app.setTitle('Login');
    this.teamId = this.route.snapshot.queryParamMap.get("team");
    this.projectId = this.route.snapshot.queryParamMap.get('project');

    this.form = this.fb.group({
      email: [null, [Validators.required, Validators.email]],
      password: [null, [Validators.required]],
      remember: [false]
    });
  }

  get teamIdQueryParam() {
    const params = [
      `team=${this.teamId}`
    ];

    if (this.projectId)
      params.push(`project=${this.projectId}`);

    return this.teamId ? `?${params.join('&')}` : '';
  }

  async ngOnInit() {
    const session = this.auth.getCurrentSession();
    if (session && !session.setup_completed) {
      void this.router.navigate(['/worklenz/setup']);
      return;
    }
    const authorized = await this.authorize();
    if (!authorized) {
      this.validating = false;
    }
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.emailInput?.nativeElement.focus();
      }, 250);
    });
  }

  public async authorize(): Promise<boolean> {
    try {
      const res: IAuthorizeResponse = await this.api.authorize();
      if (res.authenticated) {
        this.auth.setCurrentSession(res.user);
        await this.router.navigate(["/worklenz/home"]);
        return true;
      }
      return false;
    } catch (e) {
      log_error(e);
      return false;
    }
  }

  async login() {
    if (this.loading) return;
    if (this.form.valid) {
      this.loading = true;
      try {
        await this.api.login({
          email: this.form.controls['email'].value,
          password: this.form.controls['password'].value,
          team_id: this.teamId || undefined,
          project_id: this.projectId || undefined
        });
        const authorized = await this.authorize();
        this.loading = false;
        if (authorized) {
          await this.router.navigate(['/authenticate']);
        } else {
          this.app.notify('Login failed!', 'Please check your email & password and retry.', false);
        }
      } catch (e) {
        log_error(e);
        this.loading = false;
        this.app.notify('Login failed!', 'An unknown error has occurred. Please try again.', false);
      }
    } else {
      Object.values(this.form.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({onlySelf: true});
        }
      });
    }
  }

  signInWithGoogle() {
    if (this.loadingGoogle) return;
    this.loadingGoogle = true;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        window.location.href = `/secure/google${this.teamIdQueryParam}`;
      }, 1000);
    });
  }

}
