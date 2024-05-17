/* eslint-disable @angular-eslint/no-input-rename */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {SocketEvents} from '@shared/socket-events';
import {TaskListV2Service} from 'app/administrator/modules/task-list-v2/task-list-v2.service';
import {Socket} from 'ngx-socket-io';
import {Subject} from 'rxjs';
import {KanbanV2Service} from '../../../kanban-view-v2.service';
import {TaskListHashMapService} from 'app/administrator/modules/task-list-v2/task-list-hash-map.service';

@Component({
  selector: 'worklenz-kanban-task-progress',
  templateUrl: './task-progress.component.html',
  styleUrls: ['./task-progress.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskProgressComponent implements OnInit, OnDestroy {
  @Input({required: true}) task!: IProjectTask;
  private readonly destroy$ = new Subject<void>();
  loadingProgress = false;
  progress: string | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly list: TaskListV2Service,
    private readonly kanbanService: KanbanV2Service,
    private readonly map: TaskListHashMapService,
  ) {
  }

  get percent() {
    return this.task.complete_ratio || 0;
  }

  ngOnInit() {
    this.socket.on(SocketEvents.GET_TASK_PROGRESS.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.GET_TASK_PROGRESS.toString(), this.handleResponse);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private handleResponse = (response: {
    id: string;
    parent_task: string;
    complete_ratio: number;
    completed_count: number;
    total_tasks_count: number;
  }) => {
    if (response && (response.parent_task === this.task.id || response.id === this.task.id)) {
      this.task.complete_ratio = +response.complete_ratio;
      this.task.total_tasks_count = response.total_tasks_count;
      this.task.completed_count = response.completed_count;
    }
    this.cdr.markForCheck();
  }

  get tooltipTitle() {
    return (this.task.completed_count || 0) + '/' + (this.task.total_tasks_count || 0);
  }

}
