import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {AuthGuard} from "./guards/auth.guard";
import {AuthenticateComponent} from "./authenticate/authenticate.component";
import {SessionExpiredComponent} from "./session-expired/session-expired.component";
import {NotFoundComponent} from "./errors/not-found/not-found.component";
import {NotAuthorizedComponent} from "./errors/not-authorized/not-authorized.component";
import {TeamMemberGuard} from "./guards/team-member.guard";
import {LoginCheckGuard} from "./guards/login-check.guard";

const routes: Routes = [
  {path: "", redirectTo: "auth", pathMatch: "full"},
  {
    path: "auth",
    canActivate: [LoginCheckGuard],
    loadChildren: () => import("./auth/auth.module").then(m => m.AuthModule)
  },
  {path: "authenticate", component: AuthenticateComponent},
  {path: "session-expired", component: SessionExpiredComponent},
  {
    path: "worklenz",
    canActivate: [AuthGuard, TeamMemberGuard],
    loadChildren: () => import("./administrator/administrator.module").then(m => m.AdministratorModule)
  },
  {path: 'unauthorized', component: NotAuthorizedComponent},
  {path: "**", component: NotFoundComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
