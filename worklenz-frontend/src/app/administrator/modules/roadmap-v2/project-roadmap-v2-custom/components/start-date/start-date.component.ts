import {ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITaskListGroup} from "../../../../task-list-v2/interfaces";
import {formatGanttDate} from "@shared/utils";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-rm-start-date',
  templateUrl: './start-date.component.html',
  styleUrls: ['./start-date.component.scss']
})
export class RMStartDateComponent implements OnInit, OnDestroy{
  @Input({required: true}) task: IProjectTask | null = null;
  @Input({required: true}) group: ITaskListGroup | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.handleResponse);
    this.socket.on(SocketEvents.GANNT_DRAG_CHANGE.toString(), this.handleDragChangeResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.handleResponse);
    this.socket.removeListener(SocketEvents.GANNT_DRAG_CHANGE.toString(), this.handleDragChangeResponse);
  }

  private handleResponse = (response: {
    id: string;
    parent_task: string | null;
    start_date: string;
  }) => {
    if (!this.task) return;
    if (response.id === this.task.id && this.task.start_date !== response.start_date) {
      this.task.start_date = response.start_date;
      this.cdr.markForCheck();
    }
  };

  handleStartDateChange(date: string, task: IProjectTask | null) {
    if (!task) return;
    this.socket.emit(
      SocketEvents.TASK_START_DATE_CHANGE.toString(), JSON.stringify({
        task_id: task.id,
        start_date: (date) || null,
        parent_task: task.parent_task_id ? task.parent_task_id : null,
        group_id: this.group?.id,
        time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
      }));
  }

  private handleDragChangeResponse = (response: {
    task_id: string;
    task_width: number;
    task_offset: number;
    start_date: string;
    end_date: string;
  }) => {
    if (!this.task) return;
    if (this.task.id === response.task_id) {
      this.task.start_date = response.start_date;
    }
    this.cdr.detectChanges();
  };
}
