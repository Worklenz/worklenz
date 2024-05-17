import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';
import {NzContextMenuService, NzDropdownMenuComponent} from "ng-zorro-antd/dropdown";
import {IPTTask, IPTTaskListContextMenuEvent, IPTTaskListGroup} from "../../interfaces";
import {Subject, takeUntil} from "rxjs";
import {PtTaskListService} from "../../services/pt-task-list.service";
import {PtTaskListHashMapService} from "../../services/pt-task-list-hash-map.service";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {PtTasksApiService} from "@api/pt-tasks-api.service";

@Component({
  selector: 'worklenz-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContextMenuComponent implements OnDestroy {
  @ViewChild('contextMenuDropdown', {static: false}) contextMenuDropdown!: NzDropdownMenuComponent;
  @Input() templateId: string | null = null;
  @Input() groups: IPTTaskListGroup[] = [];

  protected deleting = false;
  protected hasSubTasks = false;

  selectedTask: IPTTask | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly contextMenuService: NzContextMenuService,
    private readonly service: PtTaskListService,
    private readonly map: PtTaskListHashMapService,
    private readonly api: PtTasksApiService,
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
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

  private onContextMenu(value: IPTTaskListContextMenuEvent) {
    this.selectedTask = value.task;

    this.map.deselectAll();
    this.map.selectTask(value.task);

    this.hasSubTasks = this.isSelectionHasSubTasks();

    this.cdr.detectChanges();

    this.contextMenuService.create(value.event, this.contextMenuDropdown);
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
    this.socket.emit(SocketEvents.PT_TASK_STATUS_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      status_id: statusId
    }));
  }

  handlePriorityChange(priorityId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.PT_TASK_PRIORITY_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      priority_id: priorityId
    }));
  }

  handlePhaseChange(phaseId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.PT_TASK_PHASE_CHANGE.toString(), {
      task_id: taskId,
      phase_id: phaseId
    });
  }

  async delete() {
    if (this.deleting) return;
    try {
      this.deleting = true;
      const tasks = this.map.getSelectedTaskIds();
      const res = await this.api.bulkDelete({tasks}, this.templateId as string);
      if (res.done) {
        for (const taskId of res.body.deleted_tasks) {
          this.service.deleteTask(taskId);
        }
      }
      this.deleting = false;
    } catch (e) {
      this.deleting = false;
    }
  }

}
