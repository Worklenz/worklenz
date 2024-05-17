import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {TaskListTableComponent} from "./task-list-table/task-list-table.component";

const routes: Routes = [
  {path: "", component: TaskListTableComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TaskListV2RoutingModule {
}
