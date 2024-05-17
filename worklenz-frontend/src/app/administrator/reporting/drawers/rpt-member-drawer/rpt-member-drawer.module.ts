import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptMemberDrawerComponent} from './rpt-member-drawer.component';
import {RptMemberDrawerOverviewComponent} from './rpt-member-drawer-overview/rpt-member-drawer-overview.component';
import {RptMemberDrawerProjectsComponent} from './rpt-member-drawer-projects/rpt-member-drawer-projects.component';
import {RptMemberDrawerTasksComponent} from './rpt-member-drawer-tasks/rpt-member-drawer-tasks.component';
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzGridModule} from "ng-zorro-antd/grid";
import {ReportingModule} from "../../reporting.module";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {RptProjectsListModule} from "../common/rpt-projects-list/rpt-projects-list.module";
import {RptGroupedTaskListModule} from "../common/rpt-grouped-task-list/rpt-grouped-task-list.module";
import {RptFlatTasksListModule} from "../common/rpt-flat-task-list/rpt-flat-tasks-list.module";
import {NzBreadCrumbModule} from "ng-zorro-antd/breadcrumb";
import {RptDrawerTitleComponent} from "../common/rpt-drawer-title/rpt-drawer-title.component";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {NgChartsModule} from "ng2-charts";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {NzFormModule} from "ng-zorro-antd/form";

@NgModule({
  declarations: [
    RptMemberDrawerComponent,
    RptMemberDrawerOverviewComponent,
    RptMemberDrawerProjectsComponent,
    RptMemberDrawerTasksComponent
  ],
  exports: [
    RptMemberDrawerComponent
  ],
    imports: [
        CommonModule,
        NzButtonModule,
        NzDrawerModule,
        NzIconModule,
        NzSpaceModule,
        NzTabsModule,
        NzWaveModule,
        NzBadgeModule,
        NzCardModule,
        NzGridModule,
        ReportingModule,
        SafeStringPipe,
        RptProjectsListModule,
        RptGroupedTaskListModule,
        RptFlatTasksListModule,
        NzBreadCrumbModule,
        RptDrawerTitleComponent,
        NzDropDownModule,
        NzMenuModule,
        EllipsisPipe,
        NgChartsModule,
        FormsModule,
        NzDatePickerModule,
        NzFormModule,
        ReactiveFormsModule
    ]
})
export class RptMemberDrawerModule {
}
