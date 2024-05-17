import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AccountSetupComponent} from "./account-setup/account-setup.component";
import {TeamsListComponent} from "./teams-list/teams-list.component";

const routes: Routes = [
  {path: '', component: AccountSetupComponent},
  {path: 'teams', component: TeamsListComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountSetupRoutingModule {
}
