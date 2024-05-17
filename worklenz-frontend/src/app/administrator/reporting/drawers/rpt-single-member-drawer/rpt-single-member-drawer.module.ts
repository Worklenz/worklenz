import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptSingleMemberDrawerComponent} from './rpt-single-member-drawer.component';
import {FormsModule} from "@angular/forms";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {NzBreadCrumbModule} from "ng-zorro-antd/breadcrumb";
import {RptProjectsListModule} from "../common/rpt-projects-list/rpt-projects-list.module";
import {RptGroupedTaskListModule} from "../common/rpt-grouped-task-list/rpt-grouped-task-list.module";
import {RptFlatTasksListModule} from "../common/rpt-flat-task-list/rpt-flat-tasks-list.module";
import { RptSingleMemberDrawerOverviewComponent } from './rpt-single-member-drawer-overview/rpt-single-member-drawer-overview.component';
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzCardModule} from "ng-zorro-antd/card";
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {ReportingModule} from "../../reporting.module";
import {NgChartsModule} from "ng2-charts";
import { ActivityLogsComponent } from './rpt-single-member-drawer-overview/activity-logs/activity-logs.component';
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzDividerModule} from "ng-zorro-antd/divider";
import { SingleMemberTimeLogsComponent } from './rpt-single-member-drawer-overview/time-logs/single-member-time-logs.component';
import { DurationFilterComponent } from './rpt-single-member-drawer-overview/duration-filter/duration-filter.component';
import {NzTimelineModule} from "ng-zorro-antd/timeline";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";

@NgModule({
  declarations: [
    RptSingleMemberDrawerComponent,
    RptSingleMemberDrawerOverviewComponent,
    ActivityLogsComponent,
    SingleMemberTimeLogsComponent,
    DurationFilterComponent
  ],
  exports: [
    RptSingleMemberDrawerComponent
  ],
    imports: [
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzDatePickerModule,
        NzDrawerModule,
        NzDropDownModule,
        NzFormModule,
        NzIconModule,
        NzMenuModule,
        NzSpaceModule,
        NzTabsModule,
        NzWaveModule,
        NzBreadCrumbModule,
        RptProjectsListModule,
        RptGroupedTaskListModule,
        RptFlatTasksListModule,
        NzBadgeModule,
        NzCardModule,
        EllipsisPipe,
        ReportingModule,
        NgChartsModule,
        NzSkeletonModule,
        NzDividerModule,
        NzTimelineModule,
        NzAvatarModule,
        NzTagModule,
        NzTypographyModule,
        NzToolTipModule
    ]
})
export class RptSingleMemberDrawerModule {
}
