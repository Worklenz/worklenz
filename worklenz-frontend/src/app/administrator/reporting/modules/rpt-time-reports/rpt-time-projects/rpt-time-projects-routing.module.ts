import {RouterModule, Routes} from "@angular/router";
import {NgModule} from "@angular/core";
import {TimeProjectsComponent} from "./time-projects/time-projects.component";

const routes: Routes = [
  {path: "", component: TimeProjectsComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})

export class RptTimeProjectsRoutingModule {
}
