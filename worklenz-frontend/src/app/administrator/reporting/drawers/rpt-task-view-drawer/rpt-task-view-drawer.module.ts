import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptTaskViewDrawerComponent} from './rpt-task-view-drawer.component';
import {TaskViewModule} from "@admin/components/task-view/task-view.module";

@NgModule({
  declarations: [
    RptTaskViewDrawerComponent
  ],
  exports: [
    RptTaskViewDrawerComponent
  ],
  imports: [
    CommonModule,
    TaskViewModule
  ]
})
export class RptTaskViewDrawerModule {
}
