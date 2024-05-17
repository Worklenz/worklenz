import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {MyDashboardRoutingModule} from './my-dashboard-routing.module';
import {ActivityLogComponent} from './activity-log/activity-log.component';
import {PersonalTodoListComponent} from './personal-todo-list/personal-todo-list.component';
import {DashboardComponent} from './dashboard/dashboard.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {ProjectsTasksComponent} from './projects-tasks/projects-tasks.component';
import {NzListModule} from "ng-zorro-antd/list";
import {NzCollapseModule} from "ng-zorro-antd/collapse";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {FromNowPipe} from "../../pipes/from-now.pipe";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzPageHeaderModule} from "ng-zorro-antd/page-header";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzTableModule} from "ng-zorro-antd/table";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzDividerModule} from "ng-zorro-antd/divider";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {DragDropModule} from "@angular/cdk/drag-drop";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {AvatarsComponent} from "../components/avatars/avatars.component";
import {NzSegmentedModule} from "ng-zorro-antd/segmented";
import {MyProjectsComponent} from './dashboard/my-projects/my-projects.component';
import {NzProgressModule} from 'ng-zorro-antd/progress';
import {MyTasksComponent} from './dashboard/my-tasks/my-tasks.component';
import {NzDatePickerModule} from 'ng-zorro-antd/date-picker';
import {ProjectFormModalComponent} from "../components/project-form-modal/project-form-modal.component";
import {NzRateModule} from 'ng-zorro-antd/rate';
import {EllipsisPipe} from 'app/pipes/ellipsis.pipe';
import {TaskViewModule} from "../components/task-view/task-view.module";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {NzTagModule} from "ng-zorro-antd/tag";
import {TaskNameComponent} from './dashboard/my-tasks/components/task-name/task-name.component';
import {TaskProjectComponent} from './dashboard/my-tasks/components/task-project/task-project.component';
import {TaskDueDateComponent} from './dashboard/my-tasks/components/task-due-date/task-due-date.component';
import {TaskStatusComponent} from './dashboard/my-tasks/components/task-status/task-status.component';
import {DateFormatterPipe} from "@pipes/date-formatter.pipe";
import {MinDateValidatorPipe} from "@pipes/min-date-validator.pipe";
import {TaskDoneComponent} from './dashboard/my-tasks/components/task-done/task-done.component';
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {NzCalendarModule} from "ng-zorro-antd/calendar";
import {NzAlertModule} from "ng-zorro-antd/alert";
import {TasksTableComponent} from './dashboard/my-tasks/components/tasks-table/tasks-table.component';
import {
  TaskAddContainerComponent
} from './dashboard/my-tasks/components/tasks-table/task-add-container/task-add-container.component';
import {PersonalTasksComponent} from './dashboard/personal-tasks/personal-tasks.component';
import {
    ProjectTemplateImportDrawerComponent
} from "@admin/components/project-template-import-drawer/project-template-import-drawer.component";
import {TaskListV2Module} from "../modules/task-list-v2/task-list-v2.module";

@NgModule({
  declarations: [
    ActivityLogComponent,
    PersonalTodoListComponent,
    DashboardComponent,
    ProjectsTasksComponent,
    MyProjectsComponent,
    MyTasksComponent,
    TaskNameComponent,
    TaskProjectComponent,
    TaskDueDateComponent,
    TaskStatusComponent,
    TaskDoneComponent,
    TasksTableComponent,
    TaskAddContainerComponent,
    PersonalTasksComponent
  ],
    imports: [
        CommonModule,
        MyDashboardRoutingModule,
        ReactiveFormsModule,
        FormsModule,
        NzListModule,
        NzCollapseModule,
        FromNowPipe,
        NzSelectModule,
        NzSpaceModule,
        NzPageHeaderModule,
        NzFormModule,
        NzButtonModule,
        NzInputModule,
        NzIconModule,
        NzDropDownModule,
        NzToolTipModule,
        NzCardModule,
        NzTableModule,
        NzDrawerModule,
        NzDividerModule,
        NzTypographyModule,
        DragDropModule,
        NzBadgeModule,
        AvatarsComponent,
        NzSegmentedModule,
        NzSkeletonModule,
        NzProgressModule,
        NzDatePickerModule,
        ProjectFormModalComponent,
        NzRateModule,
        EllipsisPipe,
        TaskViewModule,
        SafeStringPipe,
        NzTagModule,
        DateFormatterPipe,
        MinDateValidatorPipe,
        NzTabsModule,
        NzCalendarModule,
        NzAlertModule,
        ProjectTemplateImportDrawerComponent,
        TaskListV2Module
    ]
})
export class MyDashboardModule {
}
