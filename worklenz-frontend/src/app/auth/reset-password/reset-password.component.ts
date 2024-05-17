import {Component, ElementRef, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AppService} from '@services/app.service';
import {ActivatedRoute, Router} from '@angular/router';
import {AuthApiService} from '@api/auth-api.service';
import {AuthService} from '@services/auth.service';
import {IAuthorizeResponse} from '@interfaces/api-models/authorize-response';
import {log_error} from "@shared/utils";

@Component({
  selector: 'worklenz-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent {
  @ViewChild('emailInput') emailInput!: ElementRef<HTMLInputElement>;

  form!: FormGroup;

  loading = false;
  informationSent = false;

  teamId: string | null = null;

  constructor(
    private app: AppService,
    private router: Router,
    private api: AuthApiService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {
    this.app.setTitle('Reset Password');

    this.teamId = this.route.snapshot.queryParamMap.get('team');
    this.form = this.fb.group({
      email: [null, [Validators.required, Validators.email]]
    });
  }

  async ngOnInit() {
    await this.authorize();
  }

  public async authorize(): Promise<boolean> {
    try {
      const res: IAuthorizeResponse = await this.api.authorize();
      if (res.authenticated) {
        this.auth.setCurrentSession(res.user);
        await this.router.navigate(['/worklenz/home']);
        return true;
      }
      return false;
    } catch (e) {
      log_error(e);
      return false;
    }
  }

  async resetPassword() {
    if (this.loading) return;
    if (this.form.valid) {
      this.loading = true;
      try {
        const res = await this.api.resetPassword({email: this.form.controls['email'].value});
        if (res.done)
          this.informationSent = true;
        this.loading = false;
      } catch (e) {
        log_error(e);
        this.loading = false;
        this.app.notify('Reset password failed!', 'An unknown error has occurred. Please try again.', false);
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }
}
