import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TaskViewService} from "../task-view.service";
import {UtilsService} from "@services/utils.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";

@Component({
  selector: 'worklenz-task-view-estimation',
  templateUrl: './task-view-estimation.component.html',
  styleUrls: ['./task-view-estimation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewEstimationComponent {
  constructor(
    private readonly socket: Socket,
    public readonly service: TaskViewService,
    public readonly utils: UtilsService,
  ) {
  }

  handleTimeEstimationChange() {
    const task = this.service.model.task;
    if (!task?.id) return;

    this.socket.emit(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), JSON.stringify({
      task_id: task.id,
      total_hours: task.total_hours || 0,
      total_minutes: task.total_minutes || 0,
      parent_task: task.parent_task_id,
    }));
  }
}
