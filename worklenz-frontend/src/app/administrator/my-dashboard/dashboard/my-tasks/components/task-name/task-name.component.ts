import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import {IMyTask} from "@interfaces/my-tasks";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {TaskListV2Service} from "../../../../../modules/task-list-v2/task-list-v2.service";

@Component({
  selector: 'worklenz-task-name',
  templateUrl: './task-name.component.html',
  styleUrls: ['./task-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskNameComponent implements OnInit, OnDestroy {
  @Input() task: IMyTask | null = null;
  @Output() onOpenTask = new EventEmitter<IProjectTask>();

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly listService: TaskListV2Service
  ) {
  }

  ngOnInit(): void {
    this.socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_NAME_CHANGE.toString(), this.handleNameChangeResponse);
  }

  openTask(task: IProjectTask) {
    this.onOpenTask?.emit(task);
  }

  private handleNameChangeResponse = (response: { id: string; parent_task: string; name: string; }) => {
    if (!response || !this.task?.id) return;
    if (this.task.id == response.id) {
      this.task.name = response.name;
      this.cdr.detectChanges();
    }
  }

}
