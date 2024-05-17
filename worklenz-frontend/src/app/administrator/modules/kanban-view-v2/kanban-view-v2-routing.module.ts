import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {KanbanBoardComponent} from './kanban-board/kanban-board.component';

const routes: Routes = [
  {path: "", component: KanbanBoardComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class KanbanViewV2RoutingModule {

}
