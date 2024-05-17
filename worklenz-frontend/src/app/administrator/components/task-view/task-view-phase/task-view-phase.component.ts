import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {TaskListV2Service} from "../../../modules/task-list-v2/task-list-v2.service";
import {
  RoadmapV2Service
} from "../../../modules/roadmap-v2/project-roadmap-v2-custom/services/roadmap-v2-service.service";

@Component({
  selector: 'worklenz-task-view-phase',
  templateUrl: './task-view-phase.component.html',
  styleUrls: ['./task-view-phase.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewPhaseComponent {
  get task() {
    return this.service.model.task;
  }

  get phases() {
    return this.service.model.phases ?? [];
  }

  constructor(
    private readonly socket: Socket,
    private readonly service: TaskViewService,
    private readonly list: TaskListV2Service,
    private readonly roadmapService: RoadmapV2Service,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  handleChange(phaseId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      task_id: taskId,
      phase_id: phaseId,
      parent_task: this.service.model.task?.parent_task_id || null
    });

    this.socket.once(SocketEvents.TASK_PHASE_CHANGE.toString(), () => {
      this.service.emitPhaseChange();

      if(this.list.getCurrentGroup().value === this.list.GROUP_BY_PHASE_VALUE && this.list.isSubtasksIncluded) {
        this.list.emitRefreshSubtasksIncluded();
      }

      if (this.roadmapService.getCurrentGroup().value === this.roadmapService.GROUP_BY_PHASE_VALUE) {
        this.roadmapService.onGroupChange(taskId, phaseId as string)
      }
      this.cdr.markForCheck();
    });
  }
}
