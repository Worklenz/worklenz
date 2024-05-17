import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RptProjectsListComponent} from './rpt-projects-list.component';
import {BindNaPipe} from "@pipes/bind-na.pipe";
import {NzIconModule} from "ng-zorro-antd/icon";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {NzTableModule} from "ng-zorro-antd/table";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzInputModule} from "ng-zorro-antd/input";
import {FormsModule} from "@angular/forms";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzWaveModule} from "ng-zorro-antd/core/wave";
import {NzProgressModule} from "ng-zorro-antd/progress";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NaComponent} from "@admin/components/na/na.component";
import {TasksProgressBarComponent} from "@admin/components/tasks-progress-bar/tasks-progress-bar.component";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzSelectModule} from "ng-zorro-antd/select";
import {TaskPriorityLabelComponent} from "@admin/components/task-priority-label/task-priority-label.component";
import {ReportingModule} from "../../../reporting.module";
import {NgChartsModule} from "ng2-charts";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {ProjectUpdatesDrawerComponent} from "@admin/components/project-updates-drawer/project-updates-drawer.component";

@NgModule({
  declarations: [
    RptProjectsListComponent
  ],
  exports: [
    RptProjectsListComponent,
  ],
  imports: [
    CommonModule,
    BindNaPipe,
    NzIconModule,
    SafeStringPipe,
    NzTableModule,
    NzSkeletonModule,
    NzInputModule,
    FormsModule,
    SearchByNamePipe,
    NzBadgeModule,
    NzButtonModule,
    NzWaveModule,
    NzProgressModule,
    NzTagModule,
    NaComponent,
    TasksProgressBarComponent,
    NzToolTipModule,
    NzSelectModule,
    TaskPriorityLabelComponent,
    ReportingModule,
    NgChartsModule,
    NzSpaceModule,
    EllipsisPipe,
    ProjectUpdatesDrawerComponent,
  ]
})
export class RptProjectsListModule {
}
