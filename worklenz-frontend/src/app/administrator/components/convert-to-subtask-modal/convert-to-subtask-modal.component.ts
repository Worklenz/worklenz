import {ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy, Renderer2} from '@angular/core';
import {NzListModule} from "ng-zorro-antd/list";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NgForOf, NgIf} from "@angular/common";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {NzModalModule} from 'ng-zorro-antd/modal';
import {TaskListHashMapService} from "../../modules/task-list-v2/task-list-hash-map.service";
import {ITaskListConfigV2, ITaskListGroup} from 'app/administrator/modules/task-list-v2/interfaces';
import {TasksApiService} from '@api/tasks-api.service';
import {TaskListV2Service} from 'app/administrator/modules/task-list-v2/task-list-v2.service';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {NzInputModule} from 'ng-zorro-antd/input';
import {SearchByNamePipe} from "../../../pipes/search-by-name.pipe";
import {NzTagModule} from 'ng-zorro-antd/tag';
import {NzToolTipModule} from 'ng-zorro-antd/tooltip';
import {SocketEvents} from '@shared/socket-events';
import {Socket} from 'ngx-socket-io';
import {
  SubtaskConvertService
} from 'app/administrator/modules/task-list-v2/task-list-table/task-list-context-menu/subtask-convert-service.service';
import {Subject, takeUntil} from 'rxjs';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {
  ISubtaskConvertRequest
} from 'app/administrator/modules/task-list-v2/task-list-table/task-list-context-menu/interfaces/convert-subtask-request';
import {NzMenuModule} from 'ng-zorro-antd/menu';
import {FormsModule} from '@angular/forms';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-convert-to-subtask-modal',
  templateUrl: './convert-to-subtask-modal.component.html',
  styleUrls: ['./convert-to-subtask-modal.component.scss'],
  standalone: true,
  imports: [
    NzListModule,
    NzButtonModule,
    NgIf,
    NgForOf,
    NzSkeletonModule,
    NzSpinModule,
    NzModalModule,
    NzInputModule,
    SearchByNamePipe,
    NzTagModule,
    NzToolTipModule,
    NzMenuModule,
    FormsModule,
    NzIconModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConvertToSubtaskModalComponent implements OnDestroy {

  projectId?: string | null;
  searchText: string | null = null;
  selectedTaskId: string | null = null;

  selectedTask?: IProjectTask | null;

  showConvertTasksModal = false;
  loadingGroups = false;
  converting = false;

  protected groupIds: string[] = [];
  isExpanded: boolean[] = [];
  groups: ITaskListGroup[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly map: TaskListHashMapService,
    private readonly api: TasksApiService,
    private readonly service: TaskListV2Service,
    private readonly subTaskConvertService: SubtaskConvertService,
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly ngZone: NgZone,
    private readonly kanbanService: KanbanV2Service,
    private readonly auth: AuthService,
  ) {
    this.subTaskConvertService.onConvertingSubtask
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.getTaskData(value);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getTaskData(value: ISubtaskConvertRequest) {
    this.projectId = value.projectId;
    this.selectedTask = value.selectedTask;
    void this.getGroups();
  }

  async getGroups() {
    if (!this.projectId) return;
    try {
      this.map.deselectAll();
      this.loadingGroups = true;
      const config = this.getConf();
      const res = await this.api.getTaskListV2(config) as IServerResponse<ITaskListGroup[]>;
      if (res.done) {
        this.groups = res.body;
        this.groupIds = res.body.map(g => g.id);
        await this.mapTasks(this.service.groups);
        this.showConvertTasksModal = true;
      }
      this.loadingGroups = false;
    } catch (e) {
      this.loadingGroups = false;
    }
    this.cdr.detectChanges();
  }

  private getConf(parentTaskId?: string): ITaskListConfigV2 {
    const config: ITaskListConfigV2 = {
      id: this.projectId as string,
      group: this.service.getCurrentGroup().value,
      field: null,
      order: null,
      search: null,
      statuses: null,
      members: null,
      projects: null,
      isSubtasksInclude: false
    };

    if (parentTaskId)
      config.parent_task = parentTaskId;

    return config;
  }

  private mapTasks(groups: ITaskListGroup[]) {
    for (const group of groups) {
      this.map.registerGroup(group);
      for (const task of group.tasks) {
        if (task.start_date) task.start_date = new Date(task.start_date) as any;
        if (task.end_date) task.end_date = new Date(task.end_date) as any;
      }
    }
    setTimeout(() => {
      // expanding panels after groups loaded
      this.isExpanded = this.groups.map(() => true);
    }, 50);
  }

  async convertToSubTask(toGroupId: string, parentTaskId?: string) {

    const selectedTask = this.selectedTask;
    if (!selectedTask) return;

    const groupBy = this.service.getCurrentGroup();
    if (groupBy.value === this.service.GROUP_BY_STATUS_VALUE) {
      this.handleStatusChange(toGroupId, this.selectedTask?.id);
    } else if (groupBy.value === this.service.GROUP_BY_PRIORITY_VALUE) {
      this.handlePriorityChange(toGroupId, this.selectedTask?.id as string);
    }

    try {
      this.converting = true;
      const res = await this.api.convertToSubTask(
        selectedTask.id as string,
        selectedTask.project_id as string,
        parentTaskId as string,
        groupBy.value,
        toGroupId
      );
      if (res.done) {
        this.service.updateTaskGroup(res.body, false);
        if (groupBy.value === this.service.GROUP_BY_PHASE_VALUE)
          this.service.emitRefresh();
      }
      this.reset();
    } catch (e) {
      this.converting = false;
    }
    this.kanbanService.emitRefreshGroups();
    this.cdr.detectChanges();
  }

  handleStatusChange(statusId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      status_id: statusId,
      team_id: this.auth.getCurrentSession()?.team_id
    }));
    this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), taskId);
  }

  handlePriorityChange(priorityId: string, taskId: string) {
    this.socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      priority_id: priorityId
    }));
  }

  closeModal() {
    this.showConvertTasksModal = false;
  }

  reset() {
    this.converting = false;
    this.showConvertTasksModal = false;
    this.loadingGroups = false;
    this.groups = [];
    this.groupIds = [];
    this.searchText = null;
    this.selectedTaskId = null;
  }

  toggleGroup(event: MouseEvent, index: number) {
    this.ngZone.runOutsideAngular(() => {
      const target = event.target as Element;
      if (!target) return;
      this.isExpanded[index] = !this.isExpanded[index];
    });
  }

}
