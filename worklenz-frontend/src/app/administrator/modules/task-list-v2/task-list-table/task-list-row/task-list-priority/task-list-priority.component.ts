import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2
} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskPrioritiesGetResponse} from "@interfaces/api-models/task-priorities-get-response";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {filter} from "rxjs";
import {TaskListV2Service} from "../../../task-list-v2.service";
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-task-list-priority',
  templateUrl: './task-list-priority.component.html',
  styleUrls: ['./task-list-priority.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListPriorityComponent implements OnInit, OnDestroy {
  @Input() task: IProjectTask = {};
  @HostBinding("class") cls = "flex-row task-priority";

  priorities: ITaskPrioritiesGetResponse[] = [];

  loading = false;

  constructor(
    private readonly service: TaskListV2Service,
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly element: ElementRef,
    private readonly renderer: Renderer2,
    private readonly kanbanService: KanbanV2Service
  ) {
    this.service.onPrioritiesChange$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.updatePriorities();
        this.cdr.markForCheck();
      });

    this.service.onGroupChange$
      .pipe(
        filter(value => value.taskId === this.task.id),
        filter(() => this.isGroupByPriority()),
        takeUntilDestroyed()
      )
      .subscribe(value => {
        this.task.priority = value.groupId;
        this.task.priority_color = value.color;
        this.cdr.markForCheck();
      });
  }

  ngOnInit() {
    this.updatePriorities();
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.priorities = [];
    this.socket.removeListener(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.handleResponse);
  }

  private isGroupByPriority() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_PRIORITY_VALUE;
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  handlePriorityChange(priorityId: string, data: IProjectTask) {
    this.socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), JSON.stringify({
      task_id: data.id,
      priority_id: priorityId,
      parent_task: this.task.parent_task_id
    }));
  }

  private handleResponse = (response: {
    priority_id: string | undefined;
    name: string | undefined; id: string; parent_task: string; color_code: string;
  }) => {
    if (response && response.id === this.task.id) {
      this.task.priority_color = response.color_code;
      this.task.priority = response.priority_id;

      if (this.isGroupByPriority()) {
        if (!this.task.is_sub_task) {
          this.service.updateTaskGroup(this.task, false);
        }
        if (this.service.isSubtasksIncluded) {
          this.service.emitRefreshSubtasksIncluded();
        }
      }

      this.kanbanService.emitRefreshGroups();

      this.cdr.markForCheck();
    }
  }

  private updatePriorities() {
    this.priorities = this.service.priorities;
  }

  toggleHighlightCls(active: boolean, element: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      if (active) {
        this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
      } else {
        this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
      }
    });
  }

  handleOpen(open: boolean) {
    this.toggleHighlightCls(open, this.element.nativeElement);
  }
}
