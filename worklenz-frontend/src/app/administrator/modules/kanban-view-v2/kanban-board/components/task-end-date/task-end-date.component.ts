import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {SocketEvents} from '@shared/socket-events';
import moment from 'moment';
import {Socket} from 'ngx-socket-io';
import {formatGanttDate} from "@shared/utils";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-kanban-task-end-date',
  templateUrl: './task-end-date.component.html',
  styleUrls: ['./task-end-date.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskEndDateComponent implements OnInit, OnDestroy {
  @Input() task: IProjectTask = {};

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.handleResponse);
  }

  private handleResponse = (response: {
    id: string;
    parent_task: string | null;
    end_date: string;
  }) => {
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
        parent_task: task.parent_task_id,
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

}
