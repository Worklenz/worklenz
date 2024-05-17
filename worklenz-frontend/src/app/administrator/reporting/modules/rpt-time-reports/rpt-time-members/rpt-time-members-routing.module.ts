import {RouterModule, Routes} from "@angular/router";
import {NgModule} from "@angular/core";
import {TimeMembersComponent} from "./time-members/time-members.component";

const routes: Routes = [
  {path: "", component: TimeMembersComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})

export class RptTimeMembersRoutingModule {
}
