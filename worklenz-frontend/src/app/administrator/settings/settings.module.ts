import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {SettingsRoutingModule} from './settings-routing.module';
import {SettingsComponent} from './settings/settings.component';
import {NzLayoutModule} from 'ng-zorro-antd/layout';
import {NzCardModule} from "ng-zorro-antd/card";
import {NzPageHeaderModule} from 'ng-zorro-antd/page-header';
import {NzBreadCrumbModule} from 'ng-zorro-antd/breadcrumb';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {ProfileComponent} from './profile/profile.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {TeamsComponent} from './teams/teams.component';
import {NzTableModule} from "ng-zorro-antd/table";
import {NzModalModule} from "ng-zorro-antd/modal";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {ChangePasswordComponent} from './change-password/change-password.component';
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {LanguageAndRegionComponent} from './language-and-region/language-and-region.component';
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzUploadModule} from "ng-zorro-antd/upload";
import {FromNowPipe} from "@pipes/from-now.pipe";
import {ToggleMenuButtonComponent} from "../components/toggle-menu-button/toggle-menu-button.component";
import {LabelsComponent} from './labels/labels.component';
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzTagModule} from "ng-zorro-antd/tag";
import {TaskTemplatesComponent} from './task-templates/task-templates.component';
import {TaskTemplateDrawerComponent} from "../components/task-template-drawer/task-template-drawer.component";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {TeamMembersComponent} from './team-members/team-members.component';
import {TeamMembersFormComponent} from "../components/team-members-form/team-members-form.component";
import {NzAvatarModule} from "ng-zorro-antd/avatar";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import { ProjectTemplatesComponent } from './project-templates/project-templates.component';
import { ProjectTemplateEditViewComponent } from './project-template-edit-view/project-template-edit-view.component';
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {TasksProgressBarComponent} from "@admin/components/tasks-progress-bar/tasks-progress-bar.component";
import {TaskListV2Module} from "../modules/task-list-v2/task-list-v2.module";
import {CdkDrag, CdkDragHandle, CdkDropList} from "@angular/cdk/drag-drop";
import { TaskListGroupSettingsComponent } from './project-template-edit-view/components/task-list-group-settings/task-list-group-settings.component';
import { TaskListHeaderComponent } from './project-template-edit-view/components/task-list-header/task-list-header.component';
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {AddTaskInputComponent} from "./project-template-edit-view/components/add-task-input/add-task-input.component";
import {TaskListRowComponent} from "./project-template-edit-view/task-list-row/task-list-row.component";
import{SubTasksArrowColorPipe2} from "./project-template-edit-view/pipes/sub-tasks-arrow-color.pipe";
import {SubTasksArrowIconPipe2} from "./project-template-edit-view/pipes/sub-tasks-arrow-icon.pipe";
import { TaskDescriptionComponent } from './project-template-edit-view/components/row/task-description/task-description.component';
import { TaskLabelsComponent } from './project-template-edit-view/components/row/task-labels/task-labels.component';
import {WithAlphaPipe} from "@pipes/with-alpha.pipe";
import {EllipsisTooltipTitlePipe2} from "./project-template-edit-view/pipes/ellipsis-tooltip-title.pipe";
import {EndNameCheckPipe2} from "./project-template-edit-view/pipes/end-name-check.pipe";
import { TaskPhaseComponent } from './project-template-edit-view/components/row/task-phase/task-phase.component';
import { TaskStatusComponent } from './project-template-edit-view/components/row/task-status/task-status.component';
import { TaskPriorityComponent } from './project-template-edit-view/components/row/task-priority/task-priority.component';
import { TaskEstimationComponent } from './project-template-edit-view/components/row/task-estimation/task-estimation.component';
import { TaskStartDateComponent } from './project-template-edit-view/components/row/task-start-date/task-start-date.component';
import { TaskEndDateComponent } from './project-template-edit-view/components/row/task-end-date/task-end-date.component';
import {TruncateIfLongPipe2} from "./project-template-edit-view/pipes/truncate-if-long.pipe";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {DateFormatterPipe} from "@pipes/date-formatter.pipe";
import {RxFor} from "@rx-angular/template/for";
import {NzPipesModule} from "ng-zorro-antd/pipes";
import {TaskPriorityLabelComponent} from "@admin/components/task-priority-label/task-priority-label.component";
import {EditorComponent} from "@tinymce/tinymce-angular";
import {NzInputNumberModule} from "ng-zorro-antd/input-number";
import { ContextMenuComponent } from './project-template-edit-view/components/context-menu/context-menu.component';
import { GroupFilterComponent } from './project-template-edit-view/components/group-filter/group-filter.component';
import { PhaseSettingsDrawerComponent } from './project-template-edit-view/components/phase-settings-drawer/phase-settings-drawer.component';
import { StatusSettingsDrawerComponent } from './project-template-edit-view/components/status-settings-drawer/status-settings-drawer.component';
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzDividerModule} from "ng-zorro-antd/divider";
import { TemplateNameComponent } from './project-template-edit-view/components/template-name/template-name.component';

@NgModule({
  declarations: [
    SettingsComponent,
    ProfileComponent,
    TeamsComponent,
    ChangePasswordComponent,
    LanguageAndRegionComponent,
    LabelsComponent,
    TaskTemplatesComponent,
    TeamMembersComponent,
    ProjectTemplatesComponent,
    ProjectTemplateEditViewComponent,
    TaskListGroupSettingsComponent,
    TaskListHeaderComponent,
    SubTasksArrowColorPipe2,
    SubTasksArrowIconPipe2,
    TaskListRowComponent,
    TaskDescriptionComponent,
    TaskLabelsComponent,
    EllipsisTooltipTitlePipe2,
    EndNameCheckPipe2,
    TaskPhaseComponent,
    TaskStatusComponent,
    TaskPriorityComponent,
    TaskEstimationComponent,
    TaskStartDateComponent,
    TaskEndDateComponent,
    TruncateIfLongPipe2,
    ContextMenuComponent,
    GroupFilterComponent,
    PhaseSettingsDrawerComponent,
    StatusSettingsDrawerComponent,
    TemplateNameComponent
  ],
  imports: [
    CommonModule,
    SettingsRoutingModule,
    NzLayoutModule,
    NzCardModule,
    NzPageHeaderModule,
    NzBreadCrumbModule,
    NzIconModule,
    NzTabsModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzSpinModule,
    NzTableModule,
    NzModalModule,
    NzTypographyModule,
    NzMenuModule,
    NzSpaceModule,
    NzToolTipModule,
    NzSkeletonModule,
    NzSelectModule,
    FormsModule,
    NzUploadModule,
    FromNowPipe,
    ToggleMenuButtonComponent,
    NzBadgeModule,
    NzDropDownModule,
    NzTagModule,
    TaskTemplateDrawerComponent,
    NzPopconfirmModule,
    TeamMembersFormComponent,
    NzAvatarModule,
    SearchByNamePipe,
    SafeStringPipe,
    TasksProgressBarComponent,
    TaskListV2Module,
    CdkDropList,
    EllipsisPipe,
    NzCheckboxModule,
    AddTaskInputComponent,
    CdkDrag,
    CdkDragHandle,
    WithAlphaPipe,
    NzDatePickerModule,
    DateFormatterPipe,
    RxFor,
    NzPipesModule,
    TaskPriorityLabelComponent,
    EditorComponent,
    NzInputNumberModule,
    NzDrawerModule,
    NzDividerModule,
  ],
  providers: [SearchByNamePipe],
  exports : [
    SubTasksArrowColorPipe2,
    SubTasksArrowIconPipe2,
    EllipsisTooltipTitlePipe2,
    EndNameCheckPipe2,
    TruncateIfLongPipe2
  ]
})
export class SettingsModule {
}
