import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {
  IMyDashboardAllTasksViewModel,
  IMyDashboardMyTask
} from "@interfaces/api-models/my-dashboard-all-tasks-view-model";
import {ITaskStatusViewModel} from '@interfaces/api-models/task-status-get-response';
import {NzSelectComponent} from 'ng-zorro-antd/select';
import {Subscription} from "rxjs";
import {ITaskListGroup} from "../../../modules/task-list-v2/interfaces";
import {HomepageService} from "../../homepage-service.service";
import {TasksTableComponent} from "./components/tasks-table/tasks-table.component";

@Component({
  selector: 'worklenz-my-tasks',
  templateUrl: './my-tasks.component.html',
  styleUrls: ['./my-tasks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTasksComponent implements OnInit, OnDestroy {
  @ViewChild('due_date_selector') due_date_selector!: NzSelectComponent;
  @ViewChild('project_selector') project_selector!: NzSelectComponent;
  @ViewChild(TasksTableComponent) tasksTable!: TasksTableComponent;

  readonly tasksModes = [
    {label: 'assigned to me', value: 0},
    {label: 'assigned by me', value: 1}
  ]

  selectedTasksMode = this.tasksModes[0].value;

  defaultTasksTab = 'All';

  tasks: IMyDashboardMyTask[] = [];

  groups: ITaskListGroup[] = [];

  model: IMyDashboardAllTasksViewModel = {};

  loading = false;
  showTaskDrawer = false;
  updating = false;

  options = ['List', 'Calendar'];
  private readonly myTasksActiveFilterKey = "my-dashboard-active-filter";

  projectId = null;

  private tvDeleteSubscription!: Subscription;

  get activeFilter() {
    return +(localStorage.getItem(this.myTasksActiveFilterKey) || 0);
  }

  set activeFilter(value: number) {
    localStorage.setItem(this.myTasksActiveFilterKey, value.toString());
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    public readonly service: HomepageService
  ) {
  }

  ngOnInit() {
    this.service.tasksViewConfig = {
      tasks_group_by: this.selectedTasksMode,
      current_view: this.activeFilter,
      current_tab: this.defaultTasksTab,
      is_calendar_view: this.activeFilter != 0,
      selected_date: this.activeFilter == 0 ? null : new Date(),
      time_zone: '',
    };
  }

  ngOnDestroy() {
    this.tvDeleteSubscription?.unsubscribe();
  }

  selectDateChange(date: Date) {
    if (!this.service.tasksViewConfig) return;
    this.service.tasksViewConfig.selected_date = date;
    this.service.emitGetTasks(this.service.tasksViewConfig);
  }

  handleModeChange(index: number) {
    if (!this.service.tasksViewConfig) return;
    this.service.tasksViewConfig.tasks_group_by = index;
    this.service.emitGetTasks(this.service.tasksViewConfig);
  }

  handleViewChange(index: number) {
    if (!this.service.tasksViewConfig) return;
    this.service.tasksViewConfig.current_view = index;
    this.service.tasksViewConfig.is_calendar_view = false;
    this.service.tasksViewConfig.selected_date = null;
    if (index === 1) {
      this.service.tasksViewConfig.is_calendar_view = true;
      this.service.tasksViewConfig.selected_date = new Date();
    }
    this.service.tasksViewConfig.current_tab = this.defaultTasksTab;
    this.activeFilter = index;
    this.cdr.markForCheck();
  }

  handleTasksTabChange(tabName: string) {
    if (!this.service.tasksViewConfig) return;
    this.service.tasksViewConfig.current_tab = tabName;
    this.service.emitGetTasks(this.service.tasksViewConfig);
    this.cdr.markForCheck();
  }

  emitGetTasks() {
    if (!this.service.tasksViewConfig) return;
    this.tasksTable.getTasks(true);
    this.cdr.markForCheck();
  }

}
