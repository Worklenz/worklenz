import {NgModule} from "@angular/core";
import {CommonModule, NgOptimizedImage} from "@angular/common";

import {AuthRoutingModule} from "./auth-routing.module";
import {LoginComponent} from "./login/login.component";
import {SignupComponent} from "./signup/signup.component";
import {ResetPasswordComponent} from "./reset-password/reset-password.component";
import {LayoutComponent} from "./layout/layout.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {TeamNameComponent} from './team-name/team-name.component';
import {NzFormModule} from "ng-zorro-antd/form";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {VerifyResetEmailComponent} from './verify-reset-email/verify-reset-email.component';
import {NzResultModule} from "ng-zorro-antd/result";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzProgressModule} from "ng-zorro-antd/progress";


@NgModule({
  declarations: [
    LoginComponent,
    SignupComponent,
    ResetPasswordComponent,
    LayoutComponent,
    TeamNameComponent,
    VerifyResetEmailComponent
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
    NzButtonModule,
    NzCheckboxModule,
    NzTypographyModule,
    NzTabsModule,
    NzToolTipModule,
    NzSpinModule,
    NzResultModule,
    NgOptimizedImage,
    NzPopoverModule,
    NzProgressModule
  ]
})
export class AuthModule {
}
