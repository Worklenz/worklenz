import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {RptLayoutComponent} from "./components/rpt-layout/rpt-layout.component";
import {RptTimeMembersModule} from "./modules/rpt-time-reports/rpt-time-members/rpt-time-members.module";
import {
  RptTimeEstimationVsActualModule
} from "./modules/rpt-time-reports/rpt-time-estimation-vs-actual/rpt-time-estimation-vs-actual.module";

const routes: Routes = [
  {
    path: '',
    component: RptLayoutComponent,
    children: [
      {path: "", redirectTo: "overview", pathMatch: "full"},
      {
        path: "overview",
        loadChildren: () => import("./modules/rpt-overview/rpt-overview.module").then(m => m.RptOverviewModule)
      },
      {
        path: "projects",
        loadChildren: () => import("./modules/rpt-projects/rpt-projects.module").then(m => m.RptProjectsModule)
      },
      {
        path: "members",
        loadChildren: () => import("./modules/rpt-members/rpt-members.module").then(m => m.RptMembersModule)
      },
      {
        path: "time-sheet-overview",
        loadChildren: () => import("./modules/rpt-allocation/rpt-allocation.module").then(m => m.RptAllocationModule)
      },
      {
        path: "time-sheet-projects",
        loadChildren: () => import("./modules/rpt-time-reports/rpt-time-projects/rpt-time-projects.module").then(m => m.RptTimeProjectsModule)
      },
      {
        path: "time-sheet-members",
        loadChildren: () => import("./modules/rpt-time-reports/rpt-time-members/rpt-time-members.module").then(m => m.RptTimeMembersModule)
      },
      {
        path: "time-sheet-estimated-vs-actual",
        loadChildren: () => import("./modules/rpt-time-reports/rpt-time-estimation-vs-actual/rpt-time-estimation-vs-actual.module").then(m => m.RptTimeEstimationVsActualModule)
      }
      // {path: "allocation", component: AllocationComponent},
      // {path: "projects", component: ReportingProjectsComponent},
      // {path: "members", component: ReportingMembersComponent},
      // {path: "member/:id", component: MemberInsightsComponent},
      // {path: "project/:id", component: ProjectInsightsComponent}
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportingRoutingModule {

}
