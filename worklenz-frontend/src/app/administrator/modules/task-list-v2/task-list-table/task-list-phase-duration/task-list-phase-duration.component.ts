import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ITaskListGroup} from "../../interfaces";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";

@Component({
  selector: 'worklenz-task-list-phase-duration',
  templateUrl: './task-list-phase-duration.component.html',
  styleUrls: ['./task-list-phase-duration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListPhaseDurationComponent implements OnInit, OnDestroy{
  @Input() group!: ITaskListGroup;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.socket.on(SocketEvents.PHASE_START_DATE_CHANGE.toString(), this.handleStartDateChangeResponse);
    this.socket.on(SocketEvents.PHASE_END_DATE_CHANGE.toString(), this.handleEndDateChangeResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PHASE_START_DATE_CHANGE.toString(), this.handleStartDateChangeResponse);
    this.socket.removeListener(SocketEvents.PHASE_END_DATE_CHANGE.toString(), this.handleEndDateChangeResponse);
  }

  private handleStartDateChangeResponse = (response: {
    phase_id: string;
    start_date: string;
  }) => {
    if (response.phase_id === this.group.id && this.group.start_date !== response.start_date) {
      this.group.start_date = response.start_date;
      this.cdr.markForCheck();
    }
  };

  private handleEndDateChangeResponse = (response: {
    phase_id: string;
    end_date: string;
  }) => {
    if (response.phase_id === this.group.id && this.group.end_date !== response.end_date) {
      this.group.end_date = response.end_date;
      this.cdr.markForCheck();
    }
  };

  handleStartDateChange(date: string) {
    this.socket.emit(
      SocketEvents.PHASE_START_DATE_CHANGE.toString(), JSON.stringify({
        phase_id: this.group.id,
        start_date: date || null,
      }));
  }

  handleEndDateChange(date: string) {
    this.socket.emit(
      SocketEvents.PHASE_END_DATE_CHANGE.toString(), JSON.stringify({
        phase_id: this.group.id,
        end_date: date || null,
      }));
  }
}
