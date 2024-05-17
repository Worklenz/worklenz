import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {KanbanBoardComponent} from './kanban-board/kanban-board.component';
import {TaskCardComponent} from './kanban-board/components/task-card/task-card.component';
import {TaskEndDateComponent} from './kanban-board/components/task-end-date/task-end-date.component';
import {TaskLabelsComponent} from './kanban-board/components/task-labels/task-labels.component';
import {TaskNameComponent} from './kanban-board/components/task-name/task-name.component';
import {TaskPriorityComponent} from './kanban-board/components/task-priority/task-priority.component';
import {TaskProgressComponent} from './kanban-board/components/task-progress/task-progress.component';
import {TaskSubtaskCountComponent} from './kanban-board/components/task-subtask-count/task-subtask-count.component';
import {KanbanViewV2RoutingModule} from './kanban-view-v2-routing.module';
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzListModule} from "ng-zorro-antd/list";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzProgressModule} from "ng-zorro-antd/progress";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {NzTableModule} from "ng-zorro-antd/table";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzModalModule} from 'ng-zorro-antd/modal';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {TaskViewModule} from "@admin/components/task-view/task-view.module";
import {StatusFormComponent} from '@admin/components/status-form/status-form.component';
import {FromNowPipe} from "@pipes/from-now.pipe";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzPipesModule} from "ng-zorro-antd/pipes";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {WlSafeArrayPipe} from "@pipes/wl-safe-array.pipe";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NzDrawerModule} from 'ng-zorro-antd/drawer';
import {NzAlertModule} from 'ng-zorro-antd/alert';
import {NzCardModule} from 'ng-zorro-antd/card';
import {TaskMembersComponent} from './kanban-board/components/task-members/task-members.component';
import {AvatarsComponent} from "../../components/avatars/avatars.component";
import {ValidateMinDatePipe} from './kanban-board/pipes/validate-min-date.pipe';
import {DateFormatterPipe} from '@pipes/date-formatter.pipe';
import {
  TaskCreationAssigneesComponent
} from './kanban-board/components/task-creation-assignees/task-creation-assignees.component';
import {RxFor} from '@rx-angular/template/for';

@NgModule({
  declarations: [
    KanbanBoardComponent,
    TaskCardComponent,
    TaskEndDateComponent,
    TaskLabelsComponent,
    TaskNameComponent,
    TaskPriorityComponent,
    TaskProgressComponent,
    TaskSubtaskCountComponent,
    TaskMembersComponent,
    ValidateMinDatePipe,
    TaskCreationAssigneesComponent
  ],
    exports: [
        KanbanBoardComponent,
        ValidateMinDatePipe
    ],
  imports: [
    CommonModule,
    KanbanViewV2RoutingModule,
    NzAvatarModule,
    NzBadgeModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDropDownModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzListModule,
    NzPopconfirmModule,
    NzPopoverModule,
    NzProgressModule,
    NzSelectModule,
    NzSkeletonModule,
    NzSpaceModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    NzToolTipModule,
    NzTypographyModule,
    NzModalModule,
    DragDropModule,
    TaskViewModule,
    StatusFormComponent,
    FromNowPipe,
    SearchByNamePipe,
    NzPipesModule,
    FirstCharUpperPipe,
    WlSafeArrayPipe,
    SafeStringPipe,
    FormsModule,
    ReactiveFormsModule,
    NzDrawerModule,
    NzAlertModule,
    NzCardModule,
    AvatarsComponent,
    DateFormatterPipe,
    RxFor,
  ]
})
export class KanbanViewV2Module {
}
