import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {ProjectsComponent} from './projects/projects.component';
import {ProjectOverviewComponent} from './project-insights/project-overview/project-overview.component';
import {ProjectViewComponent} from "./project-view/project-view.component";
import {MigrateTemplatesComponent} from "./projects/migrate-templates/migrate-templates.component";
import {
  MigrateMemberAllocationsComponent
} from "./projects/migrate-member-allocations/migrate-member-allocations.component";
import {MigrateProjectPhasesComponent} from "./projects/migrate-project-phases/migrate-project-phases.component";
import {MigratePhaseSortOrderComponent} from "./projects/migrate-phase-sort-order/migrate-phase-sort-order.component";

const routes: Routes = [
  {path: 'migrate', component: MigrateTemplatesComponent},
  {path: 'migrate/member-allocations', component: MigrateMemberAllocationsComponent},
  {path: 'migrate/project-phases', component: MigrateProjectPhasesComponent},
  {path: 'migrate/phase-sort-order', component: MigratePhaseSortOrderComponent},
  {path: '', component: ProjectsComponent},
  {path: 'member/:id', component: ProjectOverviewComponent},
  {path: ':id', component: ProjectViewComponent},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectsRoutingModule {
}
