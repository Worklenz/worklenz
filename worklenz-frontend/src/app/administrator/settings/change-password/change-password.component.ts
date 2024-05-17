import {Component} from '@angular/core';
import {AbstractControlOptions, FormBuilder, FormGroup, Validators} from "@angular/forms";
import {UsersService} from "@api/users.service";
import {AppService} from "@services/app.service";
import {PASSWORD_POLICY} from "@shared/constants";

@Component({
  selector: 'worklenz-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss']
})
export class ChangePasswordComponent {
  passwordChangeForm!: FormGroup;

  oldPasswordVisible = false;
  newPasswordVisible = false;
  confirmPasswordVisible = false;
  showTaskModal = false;

  loading = false;

  readonly passwordPolicy = PASSWORD_POLICY;

  constructor(
    private usersService: UsersService,
    private fb: FormBuilder,
    private app: AppService
  ) {
    this.app.setTitle("Change Password");

    this.passwordChangeForm = this.fb.group({
        password: [null, [Validators.required]],
        new_password: [null, [Validators.required]],
        confirm_password: [null, [Validators.required]]
      },
      {validators: [this.confirmPasswordsValidator]} as unknown as AbstractControlOptions
    );
  }

  async confirmPasswordsValidator(form: FormGroup) {
    const password = form.controls['new_password'].value;
    const confirmation = form.controls['confirm_password'].value;

    if (confirmation !== password) {
      return form.controls['confirm_password'].setErrors({
        passwordMismatch: true
      }); // set the error in the confirmation input/control
    }
    return form.controls['confirm_password'];
  }

  async submitForm() {
    const body = {
      password: this.passwordChangeForm.value.password,
      new_password: this.passwordChangeForm.value.new_password,
      confirm_password: this.passwordChangeForm.value.confirm_password
    };

    if (body.password && body.new_password && body.confirm_password) {
      this.passwordChangeForm.setErrors({invalid: false});
      const res: any = await this.usersService.changePassword(body);
      if (res.done) {
        this.passwordChangeForm.reset();
        this.showTaskModal = false;
      }
    }
  }
}
