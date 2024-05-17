import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptTasksDrawerComponent} from './rpt-tasks-drawer.component';
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzIconModule} from "ng-zorro-antd/icon";
import {RptGroupedTaskListModule} from "../common/rpt-grouped-task-list/rpt-grouped-task-list.module";
import {RptFlatTasksListModule} from "../common/rpt-flat-task-list/rpt-flat-tasks-list.module";
import {NzBreadCrumbModule} from "ng-zorro-antd/breadcrumb";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {RptDrawerTitleComponent} from "../common/rpt-drawer-title/rpt-drawer-title.component";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";

@NgModule({
  declarations: [
    RptTasksDrawerComponent
  ],
  exports: [
    RptTasksDrawerComponent
  ],
    imports: [
        CommonModule,
        NzDrawerModule,
        NzIconModule,
        RptGroupedTaskListModule,
        RptFlatTasksListModule,
        NzBreadCrumbModule,
        NzButtonModule,
        NzSpaceModule,
        NzWaveModule,
        RptDrawerTitleComponent,
        NzDropDownModule
    ]
})
export class RptTasksDrawerModule {
}
