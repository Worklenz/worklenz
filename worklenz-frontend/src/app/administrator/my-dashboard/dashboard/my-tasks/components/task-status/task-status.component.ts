import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IMyTask} from "@interfaces/my-tasks";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITaskListStatusChangeResponse} from "@interfaces/task-list-status-change-response";
import {Subject} from "rxjs";
import {HomepageService} from "../../../../homepage-service.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-status',
  templateUrl: './task-status.component.html',
  styleUrls: ['./task-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskStatusComponent implements OnInit, OnDestroy {
  @Input() task: IMyTask | null = null;

  loading = false;

  statuses: ITaskStatusViewModel[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly homePageService: HomepageService,
    private readonly auth: AuthService,
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleResponse);
    if (this.task?.project_statuses) {
      this.statuses = this.task.project_statuses;
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleResponse);
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  handleStatusChange(statusId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      status_id: statusId,
      parent_task: this.task?.parent_task_id,
team_id: this.auth.getCurrentSession()?.team_id
    }));
  }

  private handleResponse = (response: ITaskListStatusChangeResponse) => {
    if (!this.task) return;
    if (response && response.id === this.task.id) {
      this.task.status_color = response.color_code.slice(0, -2);
      this.task.status = response.status_id;
      if (this.homePageService.tasksViewConfig) this.homePageService.emitGetTasksWithoutLoading(this.homePageService.tasksViewConfig);
      this.cdr.markForCheck();
    }
  }
}
