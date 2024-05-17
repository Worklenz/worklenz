import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  OnDestroy,
  OnInit
} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";

@Component({
  selector: 'worklenz-task-progress',
  templateUrl: './task-progress.component.html',
  styleUrls: ['./task-progress.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskProgressComponent implements OnInit, OnDestroy {
  @Input() task: IProjectTask = {};
  @HostBinding("class") cls = "flex-row task-progress text-align-center";

  get percent() {
    return this.task.complete_ratio || 0;
  }

  get width() {
    return (this.task.complete_ratio || 0) >= 100 ? 16 : 26;
  }

  get strokeWidth() {
    return (this.task.complete_ratio || 0) >= 100 ? 9 : 7;
  }

  get tooltipTitle() {
    return (this.task.completed_count || 0) + '/' + (this.task.total_tasks_count || 0);
  }

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.GET_TASK_PROGRESS.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.GET_TASK_PROGRESS.toString(), this.handleResponse);
  }

  private handleResponse = (response: {
    id: string;
    parent_task: string;
    complete_ratio: number;
    completed_count: number;
    total_tasks_count: number;
  }) => {
    if (response && (response.parent_task === this.task.id || response.id === this.task.id)) {
      this.task.complete_ratio = +response.complete_ratio;
      this.task.total_tasks_count = response.total_tasks_count;
      this.task.completed_count = response.completed_count;
      this.cdr.markForCheck();
    }
  }
}
