import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import moment from "moment";
import {ITaskListGroup} from "../../../../task-list-v2/interfaces";
import {formatGanttDate} from "@shared/utils";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-rm-end-date',
  templateUrl: './end-date.component.html',
  styleUrls: ['./end-date.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RMEndDateComponent implements OnInit, OnDestroy {
  @Input({required: true}) task: IProjectTask | null = null;
  @Input({required: true}) group: ITaskListGroup | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.handleResponse);
    this.socket.on(SocketEvents.GANNT_DRAG_CHANGE.toString(), this.handleDragChangeResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.handleResponse);
    this.socket.removeListener(SocketEvents.GANNT_DRAG_CHANGE.toString(), this.handleDragChangeResponse);
  }

  private handleResponse = (response: {
    id: string;
    parent_task: string | null;
    end_date: string;
  }) => {
    if (!this.task) return;
    if (response.id === this.task.id && this.task.end_date !== response.end_date) {
      this.task.end_date = response.end_date;
      this.cdr.markForCheck();
    }
  };

  handleEndDateChange(date: string, task: IProjectTask) {
    this.socket.emit(
      SocketEvents.TASK_END_DATE_CHANGE.toString(), JSON.stringify({
        task_id: task.id,
        end_date: formatGanttDate(date) || null,
        parent_task: task.parent_task_id ? task.parent_task_id : null,
        group_id: this.group?.id,
        time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
      }));
  }

  checkForPastDate(endDate: any) {
    const formattedEndDate = moment(endDate).format('YYYY-MM-DD');
    return formattedEndDate < moment().format('YYYY-MM-DD');
  }

  checkForSoonDate(endDate: any) {
    const formattedEndDate = moment(endDate).format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    return formattedEndDate === moment().format('YYYY-MM-DD') || formattedEndDate === tomorrow;
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
      this.task.end_date = response.end_date;
    }
    this.cdr.detectChanges();
  };
}
