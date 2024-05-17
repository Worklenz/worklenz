import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ITaskListGroup} from "../../../../modules/task-list-v2/interfaces";
import {ReportingApiService} from "../../../reporting-api.service";
import {TaskListV2Service} from "../../../../modules/task-list-v2/task-list-v2.service";
import {ReportingDrawersService} from "../../reporting-drawers.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {TasksLogTimeService} from "@api/tasks-log-time.service";
import {TaskTimerService} from "@admin/components/task-timer/task-timer.service";

@Component({
  selector: 'worklenz-rpt-grouped-task-list',
  templateUrl: './rpt-grouped-task-list.component.html',
  styleUrls: ['./rpt-grouped-task-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptGroupedTaskListComponent implements OnInit, OnDestroy {
  @Input({required: true}) projectId: string | null = null;

  loading = false;

  groups: ITaskListGroup[] = [];

  groupBy = this.list.GROUP_BY_STATUS_VALUE;
  searchText!: string;

  get groupByOptions() {
    return this.list.GROUP_BY_OPTIONS;
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly list: TaskListV2Service,
    private readonly drawer: ReportingDrawersService,
    private readonly view: TaskViewService,
    private readonly timerService: TaskTimerService,
    private readonly socket: Socket,
  ) {
    this.view.onRefresh
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get(false);
      });

    this.timerService.onSubmitOrUpdate
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get(false);
      });
  }

  ngOnInit() {
    void this.get();
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_TIMER_STOP.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_PHASE_CHANGE.toString(), this.refreshList);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_TIMER_STOP.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_PHASE_CHANGE.toString(), this.refreshList);
  }

  refreshList = (response: any) => {
    this.get(false);
  }

  trackByGroup(index: number, data: ITaskListGroup) {
    return data.id;
  }

  trackByTask(index: number, data: IProjectTask) {
    return data.id;
  }

  private async get(showLoading = true) {
    if (!this.projectId) return;
    try {
      this.loading = showLoading;
      const res = await this.api.getTasks(this.projectId, this.groupBy);
      if (res.done) {
        this.groups = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  isGroupByStatus() {
    return this.groupBy === this.list.GROUP_BY_STATUS_VALUE;
  }

  isGroupByPriority() {
    return this.groupBy === this.list.GROUP_BY_PRIORITY_VALUE;
  }

  isGroupByPhase() {
    return this.groupBy === this.list.GROUP_BY_PHASE_VALUE;
  }

  openTask(data: IProjectTask) {
    if (data.id && this.projectId) {
      this.drawer.openTask({
        taskId: data.id,
        projectId: this.projectId
      });
    }
  }

  onGroupByChange() {
    void this.get();
  }
}

