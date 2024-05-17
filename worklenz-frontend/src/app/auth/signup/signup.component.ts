import {AfterViewInit, Component, ElementRef, NgZone, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';

import {AppService} from '@services/app.service';
import {IUserSignUpRequest} from '@interfaces/api-models/user-sign-up-request';
import {AuthApiService} from '@api/auth-api.service';
import {log_error} from "@shared/utils";
import {PASSWORD_POLICY, WORKLENZ_REDIRECT_PROJ_KEY} from "@shared/constants";
import {IPasswordValidityResult} from "@interfaces/password-validity-result";

@Component({
  selector: 'worklenz-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements AfterViewInit {
  @ViewChild("nameInput") nameInput!: ElementRef<HTMLInputElement>;

  form!: FormGroup;

  loading = false;
  validating = false;
  passwordVisible = false;
  loadingGoogle = false;

  email: string | null = null; // invited user's email
  name: string | null = null; // invited user's name
  teamId: string | null = null; // invited team id
  teamMemberId: string | null = null;
  passwordStrength: IPasswordValidityResult | null = null;

  readonly passwordPolicy = PASSWORD_POLICY;

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

  get hasPassword() {
    return this.form.controls["password"].valid;
  }

  model: IUserSignUpRequest | null = null;

  constructor(
    private readonly app: AppService,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly api: AuthApiService,
    private readonly route: ActivatedRoute,
    private readonly ngZone: NgZone
  ) {
    this.app.setTitle('Signup');

    this.email = this.route.snapshot.queryParamMap.get("email");
    this.name = this.route.snapshot.queryParamMap.get("name");
    this.teamId = this.route.snapshot.queryParamMap.get("team");
    this.teamMemberId = this.route.snapshot.queryParamMap.get("user");
    this.projectId = this.route.snapshot.queryParamMap.get('project');

    this.form = this.fb.group({
      name: [this.name, [Validators.required]],
      email: [this.email, [Validators.required, Validators.email]],
      password: [null, [Validators.required]]
    });

    this.form.controls["password"].valueChanges.subscribe(value => {
      void this.checkPasswordStrength(value);
    });
  }

  get invitationQueryParams() {
    const params = [
      `team=${this.teamId}`,
      `teamMember=${this.teamMemberId}`
    ];
    if (this.projectId)
      params.push(`project=${this.projectId}`);
    return this.teamId && this.teamMemberId ? `?${params.join('&')}` : '';
  }

  ngAfterViewInit() {
    void this.checkPasswordStrength(this.form.value.password);
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.nameInput?.nativeElement.focus();
      }, 250);
    });
  }

  async validate() {
    if (this.validating) return;
    if (this.form.valid) {
      this.validating = true;
      try {
        const body = {
          name: this.form.controls['name'].value,
          email: this.form.controls['email'].value,
          password: this.form.controls['password'].value
        };
        const res = await this.api.signupCheck(body);

        this.validating = false;
        if (res.done) {
          this.model = body;
          void this.signupWithEmail();
        }
      } catch (e) {
        log_error(e);
        this.validating = false;
        this.app.notify('Signup failed!', 'An unknown error has occurred. Please try again.', false);
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }

  signUpWithGoogle() {
    this.loadingGoogle = true;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        window.location.href = `/secure/google${this.invitationQueryParams}`;
      }, 1000);
    });
  }

  private async signupWithEmail() {
    if (this.loading) return;
    if (!this.model) return;
    try {
      this.loading = true;
      this.model.team_name = this.model?.name;

      if (this.teamId)
        this.model.team_id = this.teamId;
      if (this.teamMemberId)
        this.model.team_member_id = this.teamMemberId;
      if (this.projectId)
        this.model.project_id = this.projectId;

      await this.api.signup(this.model);
      const res = await this.api.authorize();
      if (res.authenticated) {
        await this.router.navigate(["/authenticate"]);
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }
  }

  private async checkPasswordStrength(password: string) {
    try {
      const res = await this.api.checkPasswordStrength(password);
      if (res.done) {
        this.passwordStrength = res.body;
      }
    } catch (e) {
      // ignored
    }
  }
}
