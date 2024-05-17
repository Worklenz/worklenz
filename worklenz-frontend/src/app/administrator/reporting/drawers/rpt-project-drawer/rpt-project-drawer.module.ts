import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptProjectDrawerComponent} from './rpt-project-drawer.component';
import {RptProjectDrawerOverviewComponent} from './rpt-project-drawer-overview/rpt-project-drawer-overview.component';
import {RptProjectDrawerMembersComponent} from './rpt-project-drawer-members/rpt-project-drawer-members.component';
import {RptProjectDrawerTasksComponent} from './rpt-project-drawer-tasks/rpt-project-drawer-tasks.component';
import {NzBreadCrumbModule} from "ng-zorro-antd/breadcrumb";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzGridModule} from "ng-zorro-antd/grid";
import {FormsModule} from "@angular/forms";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzProgressModule} from "ng-zorro-antd/progress";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzTableModule} from "ng-zorro-antd/table";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {BindNaPipe} from "@pipes/bind-na.pipe";
import {NzCollapseModule} from "ng-zorro-antd/collapse";
import {NzSelectModule} from "ng-zorro-antd/select";
import {RptGroupedTaskListModule} from "../common/rpt-grouped-task-list/rpt-grouped-task-list.module";
import {RptDrawerTitleComponent} from "../common/rpt-drawer-title/rpt-drawer-title.component";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {NgChartsModule} from "ng2-charts";

@NgModule({
  declarations: [
    RptProjectDrawerComponent,
    RptProjectDrawerOverviewComponent,
    RptProjectDrawerMembersComponent,
    RptProjectDrawerTasksComponent
  ],
    imports: [
        CommonModule,
        NzBreadCrumbModule,
        NzButtonModule,
        NzDrawerModule,
        NzIconModule,
        NzSpaceModule,
        NzTabsModule,
        NzWaveModule,
        NzBadgeModule,
        NzCardModule,
        NzGridModule,
        FormsModule,
        NzInputModule,
        NzProgressModule,
        NzSkeletonModule,
        NzTableModule,
        SearchByNamePipe,
        BindNaPipe,
        NzCollapseModule,
        NzSelectModule,
        RptGroupedTaskListModule,
        RptDrawerTitleComponent,
        NzDropDownModule,
        NzMenuModule,
        NgChartsModule
    ],
  exports: [
    RptProjectDrawerComponent
  ]
})
export class RptProjectDrawerModule {
}
