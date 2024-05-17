import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IProjectStatus} from "@interfaces/project-status";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {IRPTProject} from "../../interfaces";

@Component({
  selector: 'worklenz-project-status',
  templateUrl: './project-status.component.html',
  styleUrls: ['./project-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class ProjectStatusComponent implements OnInit, OnDestroy {
  @Input({required: true}) projStatuses: IProjectStatus[] = [];
  @Input({required: true}) project: IRPTProject | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.PROJECT_STATUS_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PROJECT_STATUS_CHANGE.toString(), this.handleResponse);
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  handleStatusChange(statusId: string) {
    if (!this.project?.id) return;
    this.socket.emit(SocketEvents.PROJECT_STATUS_CHANGE.toString(), JSON.stringify({
      project_id: this.project?.id,
      status_id: statusId
    }));
    this.cdr.markForCheck();
  }

  private handleResponse = (response: {
    id: string;
    status: string;
    status_icon: string;
    status_color: string;
    status_name: string
  }) => {
    if (response && this.project && response.id === this.project.id) {
      this.project.status_id = response.status;
      this.project.status_icon = response.status_icon;
      this.project.status_color = response.status_color;
      this.project.status_name = response.status_name;
      this.cdr.markForCheck();
    }
  }
}
