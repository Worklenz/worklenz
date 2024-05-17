import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {RptOverviewComponent} from "./rpt-overview/rpt-overview.component";

const routes: Routes = [
  {path: "", component: RptOverviewComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RptOverviewRoutingModule {
}
