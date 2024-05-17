import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {RptAllocationComponent} from "./rpt-allocation/rpt-allocation.component";

const routes: Routes = [
  {path: "", component: RptAllocationComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RptAllocationRoutingModule {
}
