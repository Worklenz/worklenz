import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {OverviewComponent} from './overview/overview.component';
import {UsersComponent} from './users/users.component';
import {TeamsComponent} from './teams/teams.component';
import {LayoutComponent} from './layout/layout.component';


const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {path: "", redirectTo: "overview", pathMatch: "full"},
      {path: "overview", component: OverviewComponent},
      {path: "users", component: UsersComponent},
      {path: "teams", component: TeamsComponent},
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminCenterRoutingModule {

}
