import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, ViewChild} from '@angular/core';
import {TasksApiService} from "@api/tasks-api.service";
import {IBulkAssignRequest} from "@interfaces/api-models/bulk-assign-request";
import {NzContextMenuService, NzDropdownMenuComponent} from "ng-zorro-antd/dropdown";
import {Subject, takeUntil} from "rxjs";
import {ITaskListContextMenuEvent, ITaskListGroup} from "../../interfaces";
import {TaskListHashMapService} from "../../task-list-hash-map.service";
import {TaskListV2Service} from "../../task-list-v2.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {SubtaskConvertService} from './subtask-convert-service.service';
import {ISubtaskConvertRequest} from './interfaces/convert-subtask-request';
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-list-context-menu',
  templateUrl: './task-list-context-menu.component.html',
  styleUrls: ['./task-list-context-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListContextMenuComponent implements OnDestroy {
  @ViewChild('contextMenuDropdown', {static: false}) contextMenuDropdown!: NzDropdownMenuComponent;

  @Input() archived = false;
  @Input() projectId: string | null = null;
  @Input() groups: ITaskListGroup[] = [];

  protected deleting = false;
  protected archiving = false;
  protected converting = false;
  protected assigning = false;
  protected hasSubTasks = false;

  selectedTask: IProjectTask | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly contextMenuService: NzContextMenuService,
    private readonly service: TaskListV2Service,
    private readonly map: TaskListHashMapService,
    private readonly api: TasksApiService,
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly subTaskConvertService: SubtaskConvertService,
    private readonly kanbanService: KanbanV2Service,
    private readonly auth: AuthService,
  ) {
    this.service.onContextMenu$
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.onContextMenu(value);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private onContextMenu(value: ITaskListContextMenuEvent) {
    this.selectedTask = value.task;

    this.map.deselectAll();
    this.map.selectTask(value.task);

    this.hasSubTasks = this.isSelectionHasSubTasks();

    this.cdr.detectChanges();

    this.contextMenuService.create(value.event, this.contextMenuDropdown);
  }

  async assignMe() {
    if (this.assigning) return;

    const projectId = this.service.getProjectId();
    if (!projectId) return;

    try {
      this.assigning = true;

      const body: IBulkAssignRequest = {
        tasks: this.map.getSelectedTaskIds(),
        project_id: projectId
      };
      const res = await this.api.bulkAssignMe(body);

      if (res.done) {
        this.service.emitOnAssignMe(res.body);
        this.map.deselectAll();
      }
      this.assigning = false;
    } catch (e) {
      this.assigning = false;
    }

    this.kanbanService.emitRefreshGroups();
    this.cdr.detectChanges();
  }

  private isSelectionHasSubTasks() {
    return this.map.getSelectedTasks().some(t => t.is_sub_task);
  }

  changeGroup(toGroupId: string) {
    if (!this.selectedTask) return;
    const groupBy = this.service.getCurrentGroup();
    if (groupBy.value === this.service.GROUP_BY_STATUS_VALUE) {
      this.handleStatusChange(toGroupId, this.selectedTask.id);
    } else if (groupBy.value === this.service.GROUP_BY_PRIORITY_VALUE) {
      this.handlePriorityChange(toGroupId, this.selectedTask.id);
    } else if (groupBy.value === this.service.GROUP_BY_PHASE_VALUE) {
      this.handlePhaseChange(toGroupId, this.selectedTask.id);
    }
  }

  handleStatusChange(statusId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      status_id: statusId,
      team_id: this.auth.getCurrentSession()?.team_id
    }));
    this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), taskId);
    this.kanbanService.emitRefreshGroups();
  }

  handlePriorityChange(priorityId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      priority_id: priorityId
    }));
    this.kanbanService.emitRefreshGroups();
  }

  handlePhaseChange(phaseId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      task_id: taskId,
      phase_id: phaseId
    });
    this.kanbanService.emitRefreshGroups();
  }

  async convertToTask() {
    const selectedTask = this.selectedTask;
    if (!selectedTask) return;

    try {
      this.converting = true;
      const res = await this.api.convertToTask(
        selectedTask.id as string,
        selectedTask.project_id as string
      );

      if (res.done) {
        const task = res.body;
        this.service.updateTaskGroup(task, false);
        if (this.service.getCurrentGroup().value === this.service.GROUP_BY_PHASE_VALUE)
          this.service.emitRefresh();
      }

      this.converting = false;
    } catch (e) {
      this.converting = false;
    }
  }

  async archive() {
    if (this.archiving) return;
    if (this.hasSubTasks) return;
    try {
      this.archiving = true;
      const body = {
        tasks: this.map.getSelectedTaskIds(),
        project_id: this.projectId as string
      };
      const res = await this.api.bulkArchive(body, this.archived);

      if (res.done) {
        for (const taskId of res.body) {
          this.service.deleteTask(taskId);
        }
      }

      this.archiving = false;
    } catch (e) {
      this.archiving = false;
    }
    this.kanbanService.emitRefreshGroups();
    this.cdr.detectChanges();
  }

  async delete() {
    if (this.deleting) return;
    try {
      this.deleting = true;
      const tasks = this.map.getSelectedTaskIds();
      const res = await this.api.bulkDelete({tasks}, this.projectId as string);
      if (res.done) {
        for (const taskId of res.body.deleted_tasks) {
          this.service.deleteTask(taskId);
        }
      }
      this.deleting = false;
    } catch (e) {
      this.deleting = false;
    }
    this.kanbanService.emitRefreshGroups();
  }

  showTasksModal() {
    if (this.selectedTask) {
      const subtaskConvertRequest: ISubtaskConvertRequest = {
        selectedTask: this.selectedTask,
        projectId: this.projectId as string
      }
      this.subTaskConvertService.emitConvertingToSubTask(subtaskConvertRequest);
    }
  }
}
