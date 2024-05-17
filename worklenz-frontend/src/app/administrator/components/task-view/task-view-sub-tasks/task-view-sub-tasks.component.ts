import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {ISubTask} from "@interfaces/sub-task";
import {SubTasksApiService} from "@api/sub-tasks-api.service";
import {TasksApiService} from "@api/tasks-api.service";
import {AvatarNamesMap} from "@shared/constants";
import {log_error} from "@shared/utils";
import {dispatchTasksChange} from "@shared/events";
import {TaskViewService} from "../task-view.service";
import {SocketEvents} from "@shared/socket-events";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {Socket} from "ngx-socket-io";
import {TaskListV2Service} from "../../../modules/task-list-v2/task-list-v2.service";
import {TaskListHashMapService} from "../../../modules/task-list-v2/task-list-hash-map.service";
import {Subject, takeUntil} from "rxjs";
import {
  TaskListAddTaskInputComponent
} from "../../../modules/task-list-v2/task-list-table/task-list-add-task-input/task-list-add-task-input.component";
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {ITaskListStatusChangeResponse} from "@interfaces/task-list-status-change-response";
import {
  RoadmapV2Service
} from "../../../modules/roadmap-v2/project-roadmap-v2-custom/services/roadmap-v2-service.service";

@Component({
  selector: 'worklenz-task-view-sub-tasks',
  templateUrl: './task-view-sub-tasks.component.html',
  styleUrls: ['./task-view-sub-tasks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewSubTasksComponent implements OnInit, OnDestroy {
  @ViewChild('subTaskInput', {static: false}) subTaskInput!: TaskListAddTaskInputComponent;

  @Input() taskName: string | null = null; // parent task name
  @Input() projectId: string | null = null;

  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  @Output() onCreateOrUpdate = new EventEmitter();

  groupId: string | null = null;

  loading = false;
  deleting = false;

  tasks: ISubTask[] = [];

  get taskId() {
    return this.service.model.task?.id || null;
  }

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly api: SubTasksApiService,
    private readonly tasksApi: TasksApiService,
    private readonly ref: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly list: TaskListV2Service,
    private readonly map: TaskListHashMapService,
    public readonly service: TaskViewService,
    public readonly kanbanService: KanbanV2Service,
    private readonly roadmapService: RoadmapV2Service
  ) {
    this.service.onRefreshSubTasks()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        void this.get();
      });
  }

  ngOnInit(): void {
    if (this.taskId) {
      this.groupId = this.map.getGroupId(this.taskId) as string;
    }

    void this.get();
    this.socket.on(SocketEvents.QUICK_TASK.toString(), this.handleNewTaskReceive);
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleStatusChangeResponse);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.socket.removeListener(SocketEvents.QUICK_TASK.toString(), this.handleNewTaskReceive);
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleStatusChangeResponse);
    this.tasks = [];
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  async get() {
    if (!this.taskId) return;
    try {
      this.loading = true;
      this.ref.detectChanges();
      const res = await this.api.get(this.taskId);
      if (res.done) {
        this.tasks = res.body;
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }

    this.ref.detectChanges();
  }

  async deleteTask(id?: string, data?: any) {
    if (!id) return;
    try {
      this.deleting = true;
      const res = await this.tasksApi.delete(id);
      if (res.done) {

        const deletedTask: IProjectTask = {
          parent_task_id: data.parent_task_id,
        }

        const count = this.service.model.task?.sub_tasks_count || 0;
        if (this.service.model.task)
          this.service.model.task.sub_tasks_count = Math.max(count - 1, 0);

        this.list.deleteTask(id);

        this.list.emitRefresh();

        this.kanbanService.emitDeleteSubTask(deletedTask);

        this.roadmapService.deleteSubtaskFromView(id)

        this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), data.parent_task_id);

        dispatchTasksChange();

        await this.get();
      }
      this.deleting = false;
    } catch (e) {
      this.deleting = false;
      log_error(e);
    }
  }

  editTask(data: ISubTask) {
    if (!data?.id) return;
    this.service.emitSubTaskSelect(data);
  }

  onTaskCreateOrUpdate() {
    this.get();
    this.onCreateOrUpdate.emit();
  }

  trackBy(index: number, item: ISubTask): any {
    return item?.id;
  }

  private handleNewTaskReceive = (response: IProjectTask) => {
    if (!response) return;

    // Clone and push to trigger a change detection
    const tasks = [...this.tasks];
    tasks.push(response);
    this.tasks = tasks;

    const parentTask = this.service.model.task;
    if (parentTask) {
      parentTask.complete_ratio = Number(response.complete_ratio) || 0;
      parentTask.sub_tasks_count = Number(parentTask.sub_tasks_count) || 0;
      parentTask.sub_tasks_count += 1;

      if (this.service.model.task) {
        this.service.model.task.sub_tasks_count = Number(this.service.model.task.sub_tasks_count) || 0;
        this.service.model.task.sub_tasks_count += 1;
      }

      this.service.model.task = parentTask;

      if (parentTask.id) {
        const groupId = this.map.getGroupId(parentTask.id);
        if (groupId)
          this.list.addTask(response, groupId);
      }
    }

    this.subTaskInput?.reset(false);
    this.ref.detectChanges();
  }

  private handleStatusChangeResponse = (response: ITaskListStatusChangeResponse) => {
    if (this.service.model.task && response) {

      this.service.model.task.complete_ratio = response.complete_ratio;
      this.ref.detectChanges();
    }
  }

  getSubTasksProgress() {
    const ratio = this.service.model.task?.complete_ratio || 0;
    return ratio == Infinity ? 0 : ratio;
  }
}
