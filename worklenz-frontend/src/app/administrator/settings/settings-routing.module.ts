import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {SettingsComponent} from "./settings/settings.component";
import {ProfileComponent} from "./profile/profile.component";
import {TeamsComponent} from "./teams/teams.component";
import {ChangePasswordComponent} from "./change-password/change-password.component";
import {TeamOwnerOrAdminGuard} from "../../guards/team-owner-or-admin-guard.service";
import {NonGoogleAccountGuard} from "../../guards/non-google-account.guard";
import {LanguageAndRegionComponent} from "./language-and-region/language-and-region.component";
import {LabelsComponent} from "./labels/labels.component";
import {TaskTemplatesComponent} from "./task-templates/task-templates.component";
import {TeamMembersComponent} from "./team-members/team-members.component";
import {ProjectTemplatesComponent} from "./project-templates/project-templates.component";
import {ProjectTemplateEditViewComponent} from "./project-template-edit-view/project-template-edit-view.component";

const routes: Routes = [
  {
    path: "",
    component: SettingsComponent,
    children: [
      {path: "", redirectTo: "profile", pathMatch: "full"},
      {path: "profile", component: ProfileComponent},
      {path: "language-and-region", component: LanguageAndRegionComponent},
      {path: "labels", canActivate: [TeamOwnerOrAdminGuard], component: LabelsComponent},
      {
        path: "categories",
        canActivate: [TeamOwnerOrAdminGuard],
        loadChildren: () => import("./categories/categories.module").then(m => m.CategoriesModule)
      },
      {
        path: "clients",
        canActivate: [TeamOwnerOrAdminGuard],
        loadChildren: () => import("./clients/clients.module").then(m => m.ClientsModule)
      },
      {
        path: "job-titles",
        canActivate: [TeamOwnerOrAdminGuard],
        loadChildren: () => import("./job-titles/job-titles.module").then(m => m.JobTitlesModule)
      },
      {
        path: "notifications",
        loadChildren: () => import("./notification-settings/notification-settings.module").then(m => m.NotificationSettingsModule)
      },
      {path: "teams", component: TeamsComponent},
      {path: "team-members", canActivate: [TeamOwnerOrAdminGuard], component: TeamMembersComponent},
      {path: "password", canActivate: [NonGoogleAccountGuard], component: ChangePasswordComponent},
      {path: "task-templates", canActivate: [TeamOwnerOrAdminGuard], component: TaskTemplatesComponent},
      {path: "project-templates", canActivate: [TeamOwnerOrAdminGuard], component: ProjectTemplatesComponent},
    ]
  },
  {
    path: "project-templates/edit/:id/:name",
    canActivate: [TeamOwnerOrAdminGuard],
    component: ProjectTemplateEditViewComponent
  },
]
;

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SettingsRoutingModule {
}
