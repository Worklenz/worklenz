import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {ScheduleRoutingModule} from './schedule-routing.module';
import {ScheduleViewComponent} from './schedule-view/schedule-view.component';
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzSegmentedModule} from "ng-zorro-antd/segmented";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzListModule} from "ng-zorro-antd/list";
import {ProjectScheduleComponent} from './project-schedule/project-schedule.component';
import {NzDividerModule} from "ng-zorro-antd/divider";
import {TeamScheduleComponent} from './team-schedule/team-schedule.component';
import {TaskViewModule} from "../components/task-view/task-view.module";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import { ProjectsScheduleComponent } from './schedule-v2/projects-schedule/projects-schedule.component';
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {TaskListV2Module} from "../modules/task-list-v2/task-list-v2.module";
import {RxFor} from "@rx-angular/template/for";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import { TaskAddRowComponent } from './schedule-v2/projects-schedule/components/task-add-row/task-add-row.component';
import { TaskAddInputComponent } from './schedule-v2/projects-schedule/components/task-add-input/task-add-input.component';
import {NzInputModule} from "ng-zorro-antd/input";
import { ProjectIndicatorComponent } from './schedule-v2/projects-schedule/components/project-indicator/project-indicator.component';
import { MemberIndicatorComponent } from './schedule-v2/projects-schedule/components/member-indicator/member-indicator.component';
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzSelectModule} from "ng-zorro-antd/select";
import { AddMemberAllocationComponent } from './schedule-v2/projects-schedule/components/add-member-allocation/add-member-allocation.component';
import { ContextMenuComponent } from './schedule-v2/projects-schedule/components/context-menu/context-menu.component';
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import { ProjectMemberTasksDrawerComponent } from './schedule-v2/projects-schedule/components/project-member-tasks-drawer/project-member-tasks-drawer.component';
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import { TaskListHeaderComponent } from './schedule-v2/projects-schedule/components/task-list-header/task-list-header.component';
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import { TaskNameComponent } from './schedule-v2/projects-schedule/components/task-name/task-name.component';
import { EndDateComponent } from './schedule-v2/projects-schedule/components/end-date/end-date.component';
import { StartDateComponent } from './schedule-v2/projects-schedule/components/start-date/start-date.component';
import {DateFormatterPipe} from "@pipes/date-formatter.pipe";
import { StatusComponent } from './schedule-v2/projects-schedule/components/status/status.component';
import { PriorityComponent } from './schedule-v2/projects-schedule/components/priority/priority.component';
import { PhaseComponent } from './schedule-v2/projects-schedule/components/phase/phase.component';
import { TaskListRowComponent } from './schedule-v2/projects-schedule/components/task-list-row/task-list-row.component';
import {NzTagModule} from "ng-zorro-antd/tag";
import { MemberTaskAddContainerComponent } from './schedule-v2/projects-schedule/components/member-task-add-container/member-task-add-container.component';
import { TasksContextMenuComponent } from './schedule-v2/projects-schedule/components/tasks-context-menu/tasks-context-menu.component';
import {TaskPriorityLabelComponent} from "@admin/components/task-priority-label/task-priority-label.component";

@NgModule({
  declarations: [
    ScheduleViewComponent,
    ProjectScheduleComponent,
    TeamScheduleComponent,
    ProjectsScheduleComponent,
    TaskAddRowComponent,
    TaskAddInputComponent,
    ProjectIndicatorComponent,
    MemberIndicatorComponent,
    AddMemberAllocationComponent,
    ContextMenuComponent,
    ProjectMemberTasksDrawerComponent,
    TaskListHeaderComponent,
    TaskNameComponent,
    EndDateComponent,
    StartDateComponent,
    StatusComponent,
    PriorityComponent,
    PhaseComponent,
    TaskListRowComponent,
    MemberTaskAddContainerComponent,
    TasksContextMenuComponent,
  ],
    imports: [
        CommonModule,
        ScheduleRoutingModule,
        NzEmptyModule,
        NzSpinModule,
        NzAvatarModule,
        NzPopoverModule,
        NzTypographyModule,
        NzIconModule,
        NzDatePickerModule,
        FormsModule,
        NzButtonModule,
        NzSegmentedModule,
        NzToolTipModule,
        NzDrawerModule,
        NzListModule,
        NzDividerModule,
        TaskViewModule,
        FirstCharUpperPipe,
        SafeStringPipe,
        NzSkeletonModule,
        TaskListV2Module,
        RxFor,
        NzBadgeModule,
        ReactiveFormsModule,
        NzInputModule,
        NzSpaceModule,
        NzSelectModule,
        NzDropDownModule,
        EllipsisPipe,
        NzTabsModule,
        NzCheckboxModule,
        DateFormatterPipe,
        NzTagModule,
        TaskPriorityLabelComponent
    ]
})
export class ScheduleModule {
}
