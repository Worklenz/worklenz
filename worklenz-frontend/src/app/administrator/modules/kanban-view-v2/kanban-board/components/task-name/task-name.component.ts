/* eslint-disable @angular-eslint/no-input-rename */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {SocketEvents} from '@shared/socket-events';
import {Socket} from 'ngx-socket-io';
import {KanbanV2Service} from '../../../kanban-view-v2.service';
import {Subject, takeUntil} from 'rxjs';
import {log_error} from '@shared/utils';
import {TaskListHashMapService} from 'app/administrator/modules/task-list-v2/task-list-hash-map.service';
import {TaskListV2Service} from 'app/administrator/modules/task-list-v2/task-list-v2.service';

@Component({
  selector: 'worklenz-kanban-task-name',
  templateUrl: './task-name.component.html',
  styleUrls: ['./task-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskNameComponent implements OnInit {

  @Input({required: true}) task!: IProjectTask;

  loadingName = false;
  taskName: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private kanbanService: KanbanV2Service,
    private readonly map: TaskListHashMapService,
    private readonly list: TaskListV2Service
  ) {
    this.kanbanService.onCreateSubTask
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        // this.cdr.markForCheck();
      });
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleResponse);
  }

  private handleResponse = (response: {
    id: string;
    parent_task: string | null;
    name: string;
  }) => {
    if (response.id === this.task.id && this.task.name !== response.name) {
      this.task.name = response.name;
      this.cdr.markForCheck();
    }
  };

  async getParentTaskName(id?: string) {
    if (!id) return;
    try {
      this.loadingName = true;

      const groupId = this.map.getGroupId(this.task.parent_task_id as string);
      if (!groupId || !this.task.parent_task_id) return;

      const group = this.list.groups.find(g => g.id === groupId);
      if (!group) return;

      const parentTask = group.tasks.find(t => t.id === this.task.parent_task_id);
      this.taskName = parentTask?.name as string;

      this.loadingName = false;
    } catch (e) {
      log_error(e);
      this.loadingName = false;
    }

    this.cdr.markForCheck();
  }

}
