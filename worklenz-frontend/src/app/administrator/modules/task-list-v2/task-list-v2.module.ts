import {TaskTemplateDrawerComponent} from "@admin/components/task-template-drawer/task-template-drawer.component";
import {TaskViewModule} from "@admin/components/task-view/task-view.module";
import {CdkDrag, CdkDragHandle, CdkDragPlaceholder, CdkDropList, CdkDropListGroup} from "@angular/cdk/drag-drop";
import {CdkFixedSizeVirtualScroll, CdkVirtualForOf, ScrollingModule} from "@angular/cdk/scrolling";
import {CommonModule, NgOptimizedImage} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {FromNowPipe} from "@pipes/from-now.pipe";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {WithAlphaPipe} from "@pipes/with-alpha.pipe";
import {WlSafeArrayPipe} from "@pipes/wl-safe-array.pipe";
import {RxFor} from "@rx-angular/template/for";
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
import {AvatarsComponent} from "../../components/avatars/avatars.component";
import {TaskPriorityLabelComponent} from "../../components/task-priority-label/task-priority-label.component";
import {TaskTimerComponent} from "../../components/task-timer/task-timer.component";
import {EndNameCheckPipe} from './pipes/end-name-check.pipe';
import {TaskListColumnsToggleComponent} from './task-list-columns-toggle/task-list-columns-toggle.component';
import {TaskListFiltersComponent} from './task-list-filters/task-list-filters.component';
import {TaskListBulkActionsComponent} from './task-list-table/task-list-bulk-actions/task-list-bulk-actions.component';
import {TaskListHeaderComponent} from './task-list-table/task-list-header/task-list-header.component';
import {SubTasksArrowColorPipe} from './task-list-table/task-list-row/pipes/sub-tasks-arrow-color.pipe';
import {SubTasksArrowIconPipe} from './task-list-table/task-list-row/pipes/sub-tasks-arrow-icon.pipe';
import {ValidateMinDatePipe} from './task-list-table/task-list-row/pipes/validate-min-date.pipe';
import {TaskListLabelsComponent} from './task-list-table/task-list-row/task-list-labels/task-list-labels.component';
import {TaskListMembersComponent} from './task-list-table/task-list-row/task-list-members/task-list-members.component';
import {
  TaskListPriorityComponent
} from './task-list-table/task-list-row/task-list-priority/task-list-priority.component';
import {TaskListRowComponent} from './task-list-table/task-list-row/task-list-row.component';
import {TaskListStatusComponent} from './task-list-table/task-list-row/task-list-status/task-list-status.component';
import {TaskListTimerComponent} from './task-list-table/task-list-row/task-list-timer/task-list-timer.component';
import {TaskProgressComponent} from './task-list-table/task-list-row/task-progress/task-progress.component';
import {TaskListTableComponent} from './task-list-table/task-list-table.component';

import {TaskListV2RoutingModule} from './task-list-v2-routing.module';
import {TruncateIfLongPipe} from './task-list-table/task-list-row/pipes/truncate-if-long.pipe';
import {TaskListContextMenuComponent} from './task-list-table/task-list-context-menu/task-list-context-menu.component';
import {
  TaskListAddTaskInputComponent
} from './task-list-table/task-list-add-task-input/task-list-add-task-input.component';
import {ValidateMaxDatePipe} from './task-list-table/task-list-row/pipes/validate-max-date.pipe';
import {NzPipesModule} from "ng-zorro-antd/pipes";
import {
  TaskListStartDateComponent
} from './task-list-table/task-list-row/task-list-start-date/task-list-start-date.component';
import {
  TaskListEndDateComponent
} from './task-list-table/task-list-row/task-list-end-date/task-list-end-date.component';
import {
  TaskListDescriptionComponent
} from './task-list-table/task-list-row/task-list-description/task-list-description.component';
import {
  TaskListGroupSettingsComponent
} from './task-list-table/task-list-group-settings/task-list-group-settings.component';
import {EllipsisTooltipTitlePipe} from './task-list-table/task-list-row/pipes/ellipsis-tooltip-title.pipe';
import {NzDividerModule} from "ng-zorro-antd/divider";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {
  ConvertToSubtaskModalComponent
} from "../../components/convert-to-subtask-modal/convert-to-subtask-modal.component";
import {DateFormatterPipe} from "@pipes/date-formatter.pipe";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {TaskListPhaseComponent} from './task-list-table/task-list-row/task-list-phase/task-list-phase.component';
import {
  TaskListPhaseSettingsDrawerComponent
} from './task-list-table/task-list-phase-settings-drawer/task-list-phase-settings-drawer.component';
import {TasksProgressBarComponent} from "@admin/components/tasks-progress-bar/tasks-progress-bar.component";
import { TaskListPhaseDurationComponent } from './task-list-table/task-list-phase-duration/task-list-phase-duration.component';
import {StatusFormComponent} from "@admin/components/status-form/status-form.component";

@NgModule({
  declarations: [
    TaskListTableComponent,
    TaskListFiltersComponent,
    TaskProgressComponent,
    TaskListMembersComponent,
    TaskListLabelsComponent,
    TaskListStatusComponent,
    TaskListPriorityComponent,
    TaskListTimerComponent,
    EndNameCheckPipe,
    TaskListHeaderComponent,
    TaskListColumnsToggleComponent,
    TaskListRowComponent,
    SubTasksArrowColorPipe,
    ValidateMinDatePipe,
    SubTasksArrowIconPipe,
    TaskListBulkActionsComponent,
    TruncateIfLongPipe,
    TaskListContextMenuComponent,
    ValidateMaxDatePipe,
    TaskListStartDateComponent,
    TaskListEndDateComponent,
    TaskListDescriptionComponent,
    TaskListGroupSettingsComponent,
    EllipsisTooltipTitlePipe,
    TaskListPhaseComponent,
    TaskListPhaseSettingsDrawerComponent,
    TaskListPhaseDurationComponent
  ],
    exports: [
        TaskListTableComponent,
        ValidateMaxDatePipe,
        ValidateMinDatePipe,
        TaskListRowComponent,
        SubTasksArrowColorPipe,
        SubTasksArrowIconPipe,
        TruncateIfLongPipe
    ],
    imports: [
        CommonModule,
        TaskListV2RoutingModule,
        FormsModule,
        NzFormModule,
        NzButtonModule,
        NzDropDownModule,
        NzIconModule,
        NzCheckboxModule,
        NzTypographyModule,
        NzBadgeModule,
        NzInputModule,
        NzAvatarModule,
        NzToolTipModule,
        CdkDropListGroup,
        NzSkeletonModule,
        CdkDropList,
        NzTableModule,
        NgOptimizedImage,
        NzSpaceModule,
        CdkDrag,
        CdkDragHandle,
        NzTagModule,
        EllipsisPipe,
        NzProgressModule,
        AvatarsComponent,
        SearchByNamePipe,
        ReactiveFormsModule,
        NzSelectModule,
        TaskPriorityLabelComponent,
        TaskTimerComponent,
        NzPopoverModule,
        NzEmptyModule,
        NzListModule,
        FromNowPipe,
        NzDatePickerModule,
        CdkVirtualForOf,
        CdkFixedSizeVirtualScroll,
        ScrollingModule,
        WithAlphaPipe,
        FirstCharUpperPipe,
        WlSafeArrayPipe,
        RxFor,
        TaskViewModule,
        TaskTemplateDrawerComponent,
        NzPopconfirmModule,
        NzSpinModule,
        CdkDragPlaceholder,
        NzPipesModule,
        TaskListAddTaskInputComponent,
        NzDividerModule,
        SafeStringPipe,
        ConvertToSubtaskModalComponent,
        DateFormatterPipe,
        NzDrawerModule,
        TasksProgressBarComponent,
        StatusFormComponent
    ],
  providers: [SearchByNamePipe]
})
export class TaskListV2Module {
}
