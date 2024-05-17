import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {AppService} from "@services/app.service";
import {IUpdatePasswordRequest} from "@interfaces/api-models/verify-reset-email";
import {AuthApiService} from "@api/auth-api.service";
import {log_error} from "@shared/utils";
import {PASSWORD_POLICY} from "@shared/constants";

@Component({
  selector: 'worklenz-verify-reset-email',
  templateUrl: './verify-reset-email.component.html',
  styleUrls: ['./verify-reset-email.component.scss']
})
export class VerifyResetEmailComponent implements OnInit {
  hash: string = '';
  user: string = '';

  form!: FormGroup;

  loading = false;
  passwordVisible = false;
  validating = false;

  model: IUpdatePasswordRequest = {};

  readonly passwordPolicy = PASSWORD_POLICY;

  constructor(
    private app: AppService,
    private api: AuthApiService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.app.setTitle('Reset Password');
    this.form = this.fb.group({
      password: [null, [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((data) => {
      this.hash = data.get("hash") || "";
      this.user = data.get("user") || "";
    })
  }

  async resetPassword() {
    if (this.validating) return;
    if (this.form.valid) {
      this.validating = true;
      try {
        const body: IUpdatePasswordRequest = {
          password: this.form.controls['password'].value,
          hash: this.hash,
          user: this.user
        };
        const res = await this.api.updateNewPassword(body);
        if (res.done) {
          await this.router.navigate(["/auth/login"]);
        }

        this.validating = false;
      } catch (e) {
        log_error(e);
        this.validating = false;
        this.app.notify('Reset password failed!', 'An unknown error has occurred. Please try again.', false);
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }
}
