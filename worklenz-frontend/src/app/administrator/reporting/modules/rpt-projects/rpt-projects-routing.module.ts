import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {RptProjectsComponent} from "./rpt-projects/rpt-projects.component";

const routes: Routes = [
  {path: "", component: RptProjectsComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RptProjectsRoutingModule {
}
