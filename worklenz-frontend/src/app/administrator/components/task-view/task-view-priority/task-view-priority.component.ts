import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {TaskViewService} from "../task-view.service";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {TaskListV2Service} from "../../../modules/task-list-v2/task-list-v2.service";
import {
  RoadmapV2Service
} from "../../../modules/roadmap-v2/project-roadmap-v2-custom/services/roadmap-v2-service.service";

@Component({
  selector: 'worklenz-task-view-priority',
  templateUrl: './task-view-priority.component.html',
  styleUrls: ['./task-view-priority.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class TaskViewPriorityComponent implements OnInit, OnDestroy {
  constructor(
    private readonly socket: Socket,
    public readonly service: TaskViewService,
    private readonly list: TaskListV2Service,
    private readonly cdr: ChangeDetectorRef,
    private readonly roadmapService: RoadmapV2Service
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.handleResponse)
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_PRIORITY_CHANGE.toString(), this.handleResponse)
  }

  handlePriorityChange(priorityId: string) {
    const task = this.service.model.task;
    if (!task || !task.id) return;
    this.socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), JSON.stringify({
      task_id: task.id,
      priority_id: priorityId,
      parent_task: task.parent_task_id,
    }));
    this.service.emitRefresh(task.id);
    if (this.list.getCurrentGroup().value === this.list.GROUP_BY_PRIORITY_VALUE && this.list.isSubtasksIncluded) {
      this.list.emitRefreshSubtasksIncluded();
    }
    this.cdr.detectChanges();
  }

  private handleResponse = (response: {
    priority_id: string | undefined;
    name: string | undefined; id: string; parent_task: string; color_code: string;
  }) => {
    if (response && response.id) {
      if (this.roadmapService.getCurrentGroup().value === this.roadmapService.GROUP_BY_PRIORITY_VALUE) {
        this.roadmapService.onGroupChange(response.id, response.priority_id as string)
      }
      this.cdr.markForCheck();
    }
  }

}
