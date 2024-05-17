import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {LoginComponent} from "./login/login.component";
import {SignupComponent} from "./signup/signup.component";
import {LayoutComponent} from "./layout/layout.component";
import {ResetPasswordComponent} from "./reset-password/reset-password.component";
import {VerifyResetEmailComponent} from './verify-reset-email/verify-reset-email.component';

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {path: "", redirectTo: "login", pathMatch: "full"},
      {path: "login", component: LoginComponent},
      {path: "signup", component: SignupComponent},
    ]
  },
  {
    path: "",
    children: [
      {path: "reset-password", component: ResetPasswordComponent},
      {path: "verify-reset-email/:user/:hash", component: VerifyResetEmailComponent},
      {path: "**", redirectTo: "login", pathMatch: "full"}
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule {
}
