import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {IProjectHealth} from "@interfaces/project-health";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {IRPTProject} from "../../interfaces";

@Component({
  selector: 'worklenz-project-health-selector',
  templateUrl: './project-health.component.html',
  styleUrls: ['./project-health.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectHealthComponent implements OnInit, OnDestroy {
  @Input({required: true}) projHealths: IProjectHealth[] = [];
  @Input({required: true}) project: IRPTProject| null = null;

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    this.socket.on(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), this.handleResponse);
  }

  trackById(index: number, item: ITaskStatusViewModel) {
    return item.id;
  }

  handleHealthChange(healthId: string) {
    if (!this.project?.id) return;
    this.socket.emit(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), JSON.stringify({
      project_id: this.project?.id,
      health_id: healthId
    }));
    this.cdr.markForCheck();
  }

  private handleResponse = (response: {
    health_id: string;
    id: string;
    color_code: string;
  }) => {
    if (response && this.project && response.id === this.project.id) {
      this.project.health_color = response.color_code;
      this.project.project_health = response.health_id;
      this.cdr.markForCheck();
    }
  }
}
