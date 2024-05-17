import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {ProjectsRoutingModule} from './projects-routing.module';
import {ProjectsComponent} from './projects/projects.component';
import {NzDividerModule} from 'ng-zorro-antd/divider';
import {NzModalModule} from 'ng-zorro-antd/modal';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NzFormModule} from 'ng-zorro-antd/form';
import {NzInputModule} from 'ng-zorro-antd/input';
import {NzAutocompleteModule} from 'ng-zorro-antd/auto-complete';
import {NzPageHeaderModule} from 'ng-zorro-antd/page-header';
import {NzButtonModule} from 'ng-zorro-antd/button';
import {NzTableModule} from 'ng-zorro-antd/table';
import {NzTabsModule} from 'ng-zorro-antd/tabs';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {NzListModule} from 'ng-zorro-antd/list';
import {NzTypographyModule} from 'ng-zorro-antd/typography';
import {NzSelectModule} from 'ng-zorro-antd/select';
import {NzTagModule} from 'ng-zorro-antd/tag';
import {NzCheckboxModule} from 'ng-zorro-antd/checkbox';
import {NzProgressModule} from 'ng-zorro-antd/progress';
import {NzPopconfirmModule} from 'ng-zorro-antd/popconfirm';
import {NzAvatarModule} from 'ng-zorro-antd/avatar';
import {NzToolTipModule} from 'ng-zorro-antd/tooltip';
import {NzSkeletonModule} from 'ng-zorro-antd/skeleton';
import {NzRadioModule} from 'ng-zorro-antd/radio';
import {NzDatePickerModule} from 'ng-zorro-antd/date-picker';
import {NzEmptyModule} from 'ng-zorro-antd/empty';
import {ScrollingModule} from '@angular/cdk/scrolling';
import {NzCardModule} from 'ng-zorro-antd/card';
import {NzSpaceModule} from 'ng-zorro-antd/space';
import {NzBreadCrumbModule} from 'ng-zorro-antd/breadcrumb';
import {ProjectOverviewComponent} from './project-insights/project-overview/project-overview.component';
import {NzAffixModule} from 'ng-zorro-antd/affix';
import {NzSwitchModule} from 'ng-zorro-antd/switch';
import {AdministratorModule} from '../administrator.module';
import {NzSpinModule} from 'ng-zorro-antd/spin';
import {NzLayoutModule} from 'ng-zorro-antd/layout';
import {NzBadgeModule} from 'ng-zorro-antd/badge';
import {NzPopoverModule} from 'ng-zorro-antd/popover';
import {NzCollapseModule} from 'ng-zorro-antd/collapse';
import {NzSegmentedModule} from 'ng-zorro-antd/segmented';
import {ProjectMembersComponent} from "./project-members/project-members.component";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {ProjectViewComponent} from './project-view/project-view.component';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {AllTasksAttachmentsComponent} from './all-tasks-attachments/all-tasks-attachments.component';
import {NzRateModule} from "ng-zorro-antd/rate";
import {NzAlertModule} from "ng-zorro-antd/alert";
import {StatusFormComponent} from "../components/status-form/status-form.component";
import {FromNowPipe} from "@pipes/from-now.pipe";
import {AvatarsComponent} from "../components/avatars/avatars.component";
import {ProjectMembersFormComponent} from "../components/project-members-form/project-members-form.component";
import {ProjectFormModalComponent} from "../components/project-form-modal/project-form-modal.component";
import {ImportTasksTemplateComponent} from "../components/import-tasks-template/import-tasks-template.component";
import {ProjectInsightsComponent} from './project-insights/project-insights.component';
import {TaskInsightsComponent} from './project-insights/task-insights/task-insights.component';
import {NzStatisticModule} from "ng-zorro-antd/statistic";
import {StatusOverviewComponent} from './project-insights/project-insights/status-overview/status-overview.component';
import {
  PriorityBreakdownComponent
} from './project-insights/project-insights/priority-breakdown/priority-breakdown.component';
import {
  LastUpdatedTasksComponent
} from './project-insights/project-insights/last-updated-tasks/last-updated-tasks.component';
import {ProjectStatsComponent} from './project-insights/components/project-stats/project-stats.component';
import {
  ProjectInsightsMemberOverviewComponent
} from './project-insights/project-members/project-insights-member-overview/project-insights-member-overview.component';
import {MemberStatsComponent} from './project-insights/project-members/member-stats/member-stats.component';
import {MemberTasksComponent} from './project-insights/project-members/member-tasks/member-tasks.component';
import {
  ProjectDeadlineComponent
} from './project-insights/project-insights/project-deadline/project-deadline.component';
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {NzDescriptionsModule} from "ng-zorro-antd/descriptions";
import {TaskViewModule} from "../components/task-view/task-view.module";
import {NzNoAnimationModule} from "ng-zorro-antd/core/no-animation";
import {TaskListV2Module} from "../modules/task-list-v2/task-list-v2.module";
import {NzPipesModule} from "ng-zorro-antd/pipes";
import {FirstCharUpperPipe} from "@pipes/first-char-upper.pipe";
import {WlSafeArrayPipe} from "@pipes/wl-safe-array.pipe";
import {ProjectViewExtraComponent} from './project-view/project-view-extra/project-view-extra.component';
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {KanbanViewV2Module} from '../modules/kanban-view-v2/kanban-view-v2.module';
import {DateFormatterPipe} from "../../pipes/date-formatter.pipe";
import {ProjectsListViewComponent} from './projects/projects-list-view/projects-list-view.component';
import {ProjectsFolderViewComponent} from './projects/projects-folder-view/projects-folder-view.component';
import {
  ProjectsFolderFormDrawerComponent
} from './projects/projects-folder-form-drawer/projects-folder-form-drawer.component';
import {ProjectFilterByTooltipPipe} from './projects/pipes/project-filter-by-tooltip.pipe';
import {ProjectUpdatesDrawerComponent} from "@admin/components/project-updates-drawer/project-updates-drawer.component";
import {ProjectUpdatesComponent} from './project-updates/project-updates.component';
import {NzCommentModule} from "ng-zorro-antd/comment";
import {ProjectUpdatesInputComponent} from "@admin/components/project-updates-input/project-updates-input.component";
import {ProjectUpdatesListComponent} from "@admin/components/project-updates-list/project-updates-list.component";
import {NgChartsModule} from "ng2-charts";
import {EllipsisPipe} from "@pipes/ellipsis.pipe";
import {
  ProjectTemplateCreateDrawerComponent
} from "@admin/components/project-template-create-drawer/project-template-create-drawer.component";
import {
  ProjectTemplateImportDrawerComponent
} from "@admin/components/project-template-import-drawer/project-template-import-drawer.component";
import {WorkloadGaantChartV2Component} from './components-v2/workload-gaant-chart-v2/workload-gaant-chart-v2.component';
import {TaskNameComponent} from './components-v2/workload-gaant-chart-v2/components/task-name/task-name.component';
import {WLStartDateComponent} from './components-v2/workload-gaant-chart-v2/components/start-date/start-date.component';
import {WLEndDateComponent} from './components-v2/workload-gaant-chart-v2/components/end-date/end-date.component';
import {RxFor} from "@rx-angular/template/for";
import {
  MemberTasksDrawerComponent
} from './components-v2/workload-gaant-chart-v2/components/member-tasks-drawer/member-tasks-drawer.component';
import {
  WLTaskListRowComponent
} from './components-v2/workload-gaant-chart-v2/components/task-list-row/task-list-row.component';
import {
  TaskListAddTaskInputComponent
} from "../modules/task-list-v2/task-list-table/task-list-add-task-input/task-list-add-task-input.component";
import {WLStatusComponent} from './components-v2/workload-gaant-chart-v2/components/status/status.component';
import {WLPriorityComponent} from './components-v2/workload-gaant-chart-v2/components/priority/priority.component';
import {TaskPriorityLabelComponent} from "@admin/components/task-priority-label/task-priority-label.component";
import {WLPhaseComponent} from './components-v2/workload-gaant-chart-v2/components/phase/phase.component';
import {
  OverviewTabComponent
} from './components-v2/workload-gaant-chart-v2/components/member-tasks-drawer/overview-tab/overview-tab.component';
import { MemberTaskAddContainerComponent } from './components-v2/workload-gaant-chart-v2/components/member-task-add-container/member-task-add-container.component';
import { TaskListHeaderComponent } from './components-v2/workload-gaant-chart-v2/components/task-list-header/task-list-header.component';
import { WLContextMenuComponent } from './components-v2/workload-gaant-chart-v2/components/context-menu/context-menu.component';
import {GanttChartV2Module} from "../modules/roadmap-v2/gantt-chart-v2.module";

@NgModule({
  declarations: [
    ProjectsComponent,
    ProjectOverviewComponent,
    ProjectMembersComponent,
    ProjectViewComponent,
    AllTasksAttachmentsComponent,
    ProjectInsightsComponent,
    TaskInsightsComponent,
    StatusOverviewComponent,
    PriorityBreakdownComponent,
    LastUpdatedTasksComponent,
    ProjectStatsComponent,
    ProjectInsightsMemberOverviewComponent,
    MemberStatsComponent,
    MemberTasksComponent,
    ProjectDeadlineComponent,
    ProjectViewExtraComponent,
    ProjectsListViewComponent,
    ProjectsFolderViewComponent,
    ProjectsFolderFormDrawerComponent,
    ProjectFilterByTooltipPipe,
    ProjectUpdatesComponent,
    WorkloadGaantChartV2Component,
    TaskNameComponent,
    WLStartDateComponent,
    WLEndDateComponent,
    MemberTasksDrawerComponent,
    WLTaskListRowComponent,
    WLStatusComponent,
    WLPriorityComponent,
    WLPhaseComponent,
    OverviewTabComponent,
    MemberTaskAddContainerComponent,
    TaskListHeaderComponent,
    WLContextMenuComponent
  ],
  imports: [
    CommonModule,
    ProjectsRoutingModule,
    NzDividerModule,
    NzModalModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzAutocompleteModule,
    NzPageHeaderModule,
    NzButtonModule,
    NzTableModule,
    NzTabsModule,
    NzIconModule,
    NzListModule,
    NzTypographyModule,
    NzSelectModule,
    NzTagModule,
    FormsModule,
    NzCheckboxModule,
    NzProgressModule,
    NzPopconfirmModule,
    NzAvatarModule,
    NzToolTipModule,
    NzSkeletonModule,
    NzRadioModule,
    NzDatePickerModule,
    NzEmptyModule,
    ScrollingModule,
    NzCardModule,
    NzSpaceModule,
    NzBreadCrumbModule,
    NzAffixModule,
    NzLayoutModule,
    NzSwitchModule,
    AdministratorModule,
    NzSpinModule,
    NzBadgeModule,
    NzPopoverModule,
    NzCollapseModule,
    NzSegmentedModule,
    NzDrawerModule,
    NzDropDownModule,
    DragDropModule,
    NzRateModule,
    NzAlertModule,
    StatusFormComponent,
    FromNowPipe,
    AvatarsComponent,
    ProjectMembersFormComponent,
    ProjectFormModalComponent,
    ImportTasksTemplateComponent,
    NzStatisticModule,
    SearchByNamePipe,
    NzDescriptionsModule,
    TaskViewModule,
    NzNoAnimationModule,
    TaskListV2Module,
    NzPipesModule,
    FirstCharUpperPipe,
    WlSafeArrayPipe,
    SafeStringPipe,
    DateFormatterPipe,
    KanbanViewV2Module,
    ProjectUpdatesDrawerComponent,
    NzCommentModule,
    ProjectUpdatesInputComponent,
    ProjectUpdatesListComponent,
    NgChartsModule,
    EllipsisPipe,
    ProjectTemplateCreateDrawerComponent,
    ProjectTemplateImportDrawerComponent,
    RxFor,
    TaskListAddTaskInputComponent,
    TaskPriorityLabelComponent,
    GanttChartV2Module
  ]
})
export class ProjectsModule {
}
