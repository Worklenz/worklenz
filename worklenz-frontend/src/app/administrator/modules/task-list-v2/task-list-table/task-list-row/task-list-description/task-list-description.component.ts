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
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";

@Component({
  selector: 'worklenz-task-list-description',
  templateUrl: './task-list-description.component.html',
  styleUrls: ['./task-list-description.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListDescriptionComponent implements OnInit, OnDestroy {
  @Input() task: IProjectTask = {};
  @HostBinding("class") cls = "flex-row task-description";

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), this.handleResponse);
  }

  private handleResponse = (response: { id: string; description: string; }) => {
    if (this.task.id === response?.id) {
      this.task.description = response.description;
      this.cdr.markForCheck();
    }
  };
}
