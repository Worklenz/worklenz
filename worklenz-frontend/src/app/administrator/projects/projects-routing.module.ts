import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {ProjectsComponent} from './projects/projects.component';
import {ProjectOverviewComponent} from './project-insights/project-overview/project-overview.component';
import {ProjectViewComponent} from "./project-view/project-view.component";

const routes: Routes = [
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
