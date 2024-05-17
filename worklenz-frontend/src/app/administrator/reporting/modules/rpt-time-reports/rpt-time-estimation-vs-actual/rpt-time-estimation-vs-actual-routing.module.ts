import {RouterModule, Routes} from "@angular/router";
import {NgModule} from "@angular/core";
import {
  TimeEstimationVsActualProjectsComponent
} from "./time-estimation-vs-actual-projects/time-estimation-vs-actual-projects.component";

const routes: Routes = [
  {path: "", component: TimeEstimationVsActualProjectsComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})

export class RptTimeEstimationVsActualRoutingModule {
}
