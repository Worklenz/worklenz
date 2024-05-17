import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {RptMembersComponent} from "./rpt-members/rpt-members.component";

const routes: Routes = [
  {path: "", component: RptMembersComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RptMembersRoutingModule {
}
