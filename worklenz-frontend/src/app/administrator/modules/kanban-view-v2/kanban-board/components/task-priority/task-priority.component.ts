import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {ITaskPrioritiesGetResponse} from '@interfaces/api-models/task-priorities-get-response';
import {ITaskStatusViewModel} from '@interfaces/api-models/task-status-get-response';
import {SocketEvents} from '@shared/socket-events';
import {TaskListV2Service} from 'app/administrator/modules/task-list-v2/task-list-v2.service';
import {Socket} from 'ngx-socket-io';
import {Subject} from 'rxjs';

@Component({
  selector: 'worklenz-kanban-task-priority',
  templateUrl: './task-priority.component.html',
  styleUrls: ['./task-priority.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskPriorityComponent implements OnInit, OnDestroy {
  @Input() task: IProjectTask = {};

  priorities: ITaskPrioritiesGetResponse[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    public readonly service: TaskListV2Service,
  ) {
  }

  ngOnInit() {
    this.updatePriorities();
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.priorities = [];
    this.destroy$.next();
    this.destroy$.complete();
    this.socket.removeListener(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.handleResponse);
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  private handleResponse = (response: {
    priority_id: string | undefined;
    name: string | undefined; id: string; parent_task: string; color_code: string;
  }) => {
    if (response && response.id === this.task.id) {
      this.task.priority_color = response.color_code;
      this.task.priority = response.priority_id;
      this.cdr.markForCheck();
    }
  }

  private updatePriorities() {
    this.priorities = this.service.priorities;
  }
}
