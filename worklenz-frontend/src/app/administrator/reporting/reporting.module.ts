import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {NzButtonModule} from 'ng-zorro-antd/button';
import {NzDropDownModule} from 'ng-zorro-antd/dropdown';
import {NzCheckboxModule} from 'ng-zorro-antd/checkbox';
import {NzSpaceModule} from 'ng-zorro-antd/space';
import {NzPageHeaderModule} from 'ng-zorro-antd/page-header';
import {RptLayoutComponent} from './components/rpt-layout/rpt-layout.component';
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {RouterLink, RouterLinkActive, RouterOutlet} from "@angular/router";
import {ReportingRoutingModule} from "./reporting-routing.module";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {WithCountPipe} from './pipes/with-count.pipe';
import { ProjectHealthComponent } from './components/project-health/project-health.component';
import {NzSelectModule} from "ng-zorro-antd/select";
import { ProjectStartEndDatesComponent } from './components/project-start-end-dates/project-start-end-dates.component';
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {TaskListV2Module} from "../modules/task-list-v2/task-list-v2.module";
import { ProjectStatusComponent } from './components/project-status/project-status.component';
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import { ProjectCategoryComponent } from './components/project-category/project-category.component';
import {NzTagModule} from "ng-zorro-antd/tag";
import {NaComponent} from "@admin/components/na/na.component";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzSpinModule} from "ng-zorro-antd/spin";
import { RptMemberProjectsListComponent } from './drawers/common/rpt-member-projects-list/rpt-member-projects-list.component';
import {BindNaPipe} from "@pipes/bind-na.pipe";
import {NzTableModule} from "ng-zorro-antd/table";
import {TasksProgressBarComponent} from "@admin/components/tasks-progress-bar/tasks-progress-bar.component";
import {NzProgressModule} from "ng-zorro-antd/progress";
import { EstimatedVsActualChartComponent } from './components/estimated-vs-actual-chart/estimated-vs-actual-chart.component';
import {NgChartsModule} from "ng2-charts";
import { ProjectLogsBreakdownComponent } from './components/project-logs-breakdown/project-logs-breakdown.component';
import { MemberLogsBreakdownComponent } from './components/member-logs-breakdown/member-logs-breakdown.component';
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzTimelineModule} from "ng-zorro-antd/timeline";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzDividerModule} from "ng-zorro-antd/divider";
import { RptSingleMemberStatComponent } from './drawers/rpt-single-member-stat/rpt-single-member-stat.component';
import {RptDrawerTitleComponent} from "./drawers/common/rpt-drawer-title/rpt-drawer-title.component";
import {NzCollapseModule} from "ng-zorro-antd/collapse";
import { RptSingleMemberProjectsDrawerComponent } from './drawers/rpt-single-member-projects-drawer/rpt-single-member-projects-drawer.component';
import {EllipsisPipe} from "@pipes/ellipsis.pipe";

@NgModule({
  declarations: [
    RptLayoutComponent,
    WithCountPipe,
    ProjectHealthComponent,
    ProjectStartEndDatesComponent,
    ProjectStatusComponent,
    ProjectCategoryComponent,
    RptMemberProjectsListComponent,
    EstimatedVsActualChartComponent,
    ProjectLogsBreakdownComponent,
    MemberLogsBreakdownComponent,
    RptSingleMemberStatComponent,
    RptSingleMemberProjectsDrawerComponent
  ],
    exports: [
        WithCountPipe,
        ProjectHealthComponent,
        ProjectStartEndDatesComponent,
        ProjectStatusComponent,
        ProjectCategoryComponent,
        RptMemberProjectsListComponent,
        EstimatedVsActualChartComponent,
        ProjectLogsBreakdownComponent,
        RptSingleMemberStatComponent,
        RptSingleMemberProjectsDrawerComponent
    ],
    imports: [
        CommonModule,
        NzSpaceModule,
        NzDropDownModule,
        NzButtonModule,
        NzIconModule,
        NzPageHeaderModule,
        FormsModule,
        NzCheckboxModule,
        NzLayoutModule,
        NzTypographyModule,
        RouterLink,
        RouterOutlet,
        RouterLinkActive,
        ReportingRoutingModule,
        NzToolTipModule,
        NzSkeletonModule,
        NzSelectModule,
        NzDatePickerModule,
        TaskListV2Module,
        SafeStringPipe,
        NzBadgeModule,
        NzTagModule,
        NaComponent,
        SearchByNamePipe,
        ReactiveFormsModule,
        NzInputModule,
        NzFormModule,
        NzSpinModule,
        BindNaPipe,
        NzTableModule,
        TasksProgressBarComponent,
        NzProgressModule,
        NgChartsModule,
        NzDrawerModule,
        NzTimelineModule,
        FirstCharUpperPipe,
        NzAvatarModule,
        NzCardModule,
        NzDividerModule,
        RptDrawerTitleComponent,
        NzCollapseModule,
        EllipsisPipe
    ]
})
export class ReportingModule {
}
