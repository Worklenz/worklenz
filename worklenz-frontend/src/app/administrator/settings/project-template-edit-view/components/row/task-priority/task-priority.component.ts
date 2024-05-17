import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  Renderer2
} from '@angular/core';
import {IPTTask} from "../../../interfaces";
import {PtTaskListService} from "../../../services/pt-task-list.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {filter} from "rxjs";
import {ITaskPrioritiesGetResponse} from "@interfaces/api-models/task-priorities-get-response";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";

@Component({
  selector: 'worklenz-task-priority',
  templateUrl: './task-priority.component.html',
  styleUrls: ['./task-priority.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskPriorityComponent {
  @Input() task: IPTTask = {};
  @HostBinding("class") cls = "flex-row task-priority";

  priorities: ITaskPrioritiesGetResponse[] = [];

  loading = false;

  constructor(
    private readonly service: PtTaskListService,
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly element: ElementRef,
    private readonly renderer: Renderer2
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
    this.socket.on(SocketEvents.PT_TASK_PRIORITY_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.priorities = [];
    this.socket.removeListener(SocketEvents.PT_TASK_PRIORITY_CHANGE.toString(), this.handleResponse);
  }

  private isGroupByPriority() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_PRIORITY_VALUE;
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  handlePriorityChange(priorityId: string, data: IPTTask) {
    this.socket.emit(SocketEvents.PT_TASK_PRIORITY_CHANGE.toString(), JSON.stringify({
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

