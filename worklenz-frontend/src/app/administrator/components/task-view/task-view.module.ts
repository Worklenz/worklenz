import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {TaskViewComponent} from "./task-view.component";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzFormModule} from "ng-zorro-antd/form";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {TaskViewInfoComponent} from "./task-view-info/task-view-info.component";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzCollapseModule} from "ng-zorro-antd/collapse";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {AvatarsComponent} from "../avatars/avatars.component";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {SearchByNamePipe} from "../../../pipes/search-by-name.pipe";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {NzInputNumberModule} from "ng-zorro-antd/input-number";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzDividerModule} from "ng-zorro-antd/divider";
import {FromNowPipe} from "@pipes/from-now.pipe";
import {TaskViewAssigneesComponent} from './task-view-assignees/task-view-assignees.component';
import {TaskViewDueDateComponent} from './task-view-due-date/task-view-due-date.component';
import {TaskViewEstimationComponent} from './task-view-estimation/task-view-estimation.component';
import {TaskViewPriorityComponent} from './task-view-priority/task-view-priority.component';
import {TaskViewLabelsComponent} from './task-view-labels/task-view-labels.component';
import {TaskViewDescriptionComponent} from './task-view-description/task-view-description.component';
import {TaskViewSubTasksComponent} from './task-view-sub-tasks/task-view-sub-tasks.component';
import {TaskViewNameComponent} from './task-view-name/task-view-name.component';
import {TaskPriorityLabelComponent} from "../task-priority-label/task-priority-label.component";
import {TaskViewAttachmentsComponent} from './task-view-attachments/task-view-attachments.component';
import {
  TaskViewAttachmentsThumbComponent
} from './task-view-attachments/task-view-attachments-thumb/task-view-attachments-thumb.component';
import {NzButtonModule} from "ng-zorro-antd/button";
import {TaskViewCommentsComponent} from './task-view-comments/task-view-comments.component';
import {TaskViewCommentsInputComponent} from './task-view-comments-input/task-view-comments-input.component';
import {NzCommentModule} from "ng-zorro-antd/comment";
import {RouterLink} from "@angular/router";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzMentionModule} from "ng-zorro-antd/mention";
import {NzAffixModule} from "ng-zorro-antd/affix";
import {NzNoAnimationModule} from "ng-zorro-antd/core/no-animation";
import {NzPopconfirmModule} from 'ng-zorro-antd/popconfirm';
import {NzCardModule} from "ng-zorro-antd/card";
import {NzTableModule} from "ng-zorro-antd/table";
import {NzProgressModule} from "ng-zorro-antd/progress";
import {EditorModule, TINYMCE_SCRIPT_SRC} from '@tinymce/tinymce-angular';
import {TaskViewTimeLogComponent} from './task-view-time-log/task-view-time-log.component';
import {NzListModule} from "ng-zorro-antd/list";
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {TaskTimerComponent} from "../task-timer/task-timer.component";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {
  TaskListAddTaskInputComponent
} from "../../modules/task-list-v2/task-list-table/task-list-add-task-input/task-list-add-task-input.component";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {DateFormatterPipe} from "../../../pipes/date-formatter.pipe";
import {TaskViewNotifyToUserComponent} from './task-view-notify-to-user/task-view-notify-to-user.component';
import {NgxDocViewerModule} from 'ngx-doc-viewer';
import {NzModalModule} from 'ng-zorro-antd/modal';
import {NzSpinModule} from "ng-zorro-antd/spin";
import {
  TaskViewActivityLogComponent
} from "@admin/components/task-view/task-view-activity-log/task-view-activity-log.component";
import {NzTimelineModule} from "ng-zorro-antd/timeline";
import {TaskViewPhaseComponent} from './task-view-phase/task-view-phase.component';
import {NzTimePickerModule} from "ng-zorro-antd/time-picker";
import {TaskCommentMentionPipe} from "@pipes/task-comment-mention.pipe";

@NgModule({
  declarations: [
    TaskViewComponent,
    TaskViewInfoComponent,
    TaskViewAssigneesComponent,
    TaskViewDueDateComponent,
    TaskViewEstimationComponent,
    TaskViewPriorityComponent,
    TaskViewLabelsComponent,
    TaskViewDescriptionComponent,
    TaskViewSubTasksComponent,
    TaskViewNameComponent,
    TaskViewAttachmentsComponent,
    TaskViewAttachmentsThumbComponent,
    TaskViewCommentsComponent,
    TaskViewCommentsInputComponent,
    TaskViewTimeLogComponent,
    TaskViewNotifyToUserComponent,
    TaskViewActivityLogComponent,
    TaskViewPhaseComponent
  ],
  exports: [
    TaskViewComponent
  ],
  providers: [
    SearchByNamePipe,
    { provide: TINYMCE_SCRIPT_SRC, useValue: 'tinymce/tinymce.min.js' }
  ],
  imports: [
    CommonModule,
    NzDrawerModule,
    NzSkeletonModule,
    NzFormModule,
    FormsModule,
    NzInputModule,
    NzSelectModule,
    NzTabsModule,
    NzTagModule,
    NzCollapseModule,
    NzDropDownModule,
    AvatarsComponent,
    NzAvatarModule,
    NzTypographyModule,
    NzCheckboxModule,
    SearchByNamePipe,
    NzToolTipModule,
    NzDatePickerModule,
    NzInputNumberModule,
    NzIconModule,
    NzBadgeModule,
    NzDividerModule,
    FromNowPipe,
    ReactiveFormsModule,
    TaskPriorityLabelComponent,
    NzButtonModule,
    NzCommentModule,
    RouterLink,
    NzSpaceModule,
    NzMentionModule,
    NzAffixModule,
    NzNoAnimationModule,
    NzPopconfirmModule,
    NzCardModule,
    NzTableModule,
    NzProgressModule,
    EditorModule,
    NzListModule,
    NzEmptyModule,
    TaskTimerComponent,
    FirstCharUpperPipe,
    TaskListAddTaskInputComponent,
    SafeStringPipe,
    DateFormatterPipe,
    NgxDocViewerModule,
    NzModalModule,
    NzSpinModule,
    NzTimelineModule,
    NzTimePickerModule,
    TaskCommentMentionPipe
  ]
})
export class TaskViewModule {
}
