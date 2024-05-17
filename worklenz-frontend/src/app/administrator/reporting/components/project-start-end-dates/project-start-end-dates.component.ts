import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {IRPTProject} from "../../interfaces";

@Component({
  selector: 'worklenz-project-start-end-dates',
  templateUrl: './project-start-end-dates.component.html',
  styleUrls: ['./project-start-end-dates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectStartEndDatesComponent implements OnInit, OnDestroy  {
  @Input({required: true}) project: IRPTProject | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), this.handleStartdateChangeResponse);
    this.socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), this.handleEnddateChangeResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), this.handleStartdateChangeResponse);
    this.socket.removeListener(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), this.handleEnddateChangeResponse);
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  handleStartDateChange(date: string) {
    if (!this.project?.id) return;
    this.socket.emit(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), JSON.stringify({
      project_id: this.project?.id,
      start_date: date
    }));
    this.cdr.markForCheck();
  }

  handleEndDateChange(date: string) {
    if (!this.project?.id) return;
    this.socket.emit(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), JSON.stringify({
      project_id: this.project?.id,
      end_date: date
    }));
    this.cdr.markForCheck();
  }

  private handleStartdateChangeResponse = (response: {
    start_date: string;
    id: string;
  }) => {
    if (response && this.project && response.id === this.project.id) {
      this.project.start_date = response.start_date;
      this.cdr.markForCheck();
    }
  }

  private handleEnddateChangeResponse = (response: {
    end_date: string;
    id: string;
  }) => {
    if (response && this.project && response.id === this.project.id) {
      this.project.end_date = response.end_date;
      this.cdr.markForCheck();
    }
  }

}
