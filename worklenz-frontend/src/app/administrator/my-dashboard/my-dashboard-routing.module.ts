import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {DashboardComponent} from "./dashboard/dashboard.component";

const routes: Routes = [
  {path: "", component: DashboardComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MyDashboardRoutingModule {
}
