import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {Socket} from "ngx-socket-io";
import {AuthService} from "@services/auth.service";
import {SocketEvents} from "@shared/socket-events";
import {log_error} from "@shared/utils";
import {ITaskCreateRequest} from "@interfaces/api-models/task-create-request";
import {DEFAULT_TASK_NAME} from "@shared/constants";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";
import {ProjectScheduleService} from "../../service/project-schedule-service.service";

@Component({
  selector: 'worklenz-task-add-row',
  templateUrl: './task-add-row.component.html',
  styleUrls: ['./task-add-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskAddRowComponent {
  // @Input({required: true}) projectId: string | null = null;
  // @Input({required: true}) teamMemberId: string | null = null;
  // @Input({required: true}) chartStart: string | null = null;
  // @Output() openTask = new EventEmitter<IProjectTask>();

  left: number = 0;
  width: number = 0;

  private readonly _session: ILocalSession | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ProjectScheduleService,
  ) {
    this._session = this.auth.getCurrentSession();
  }

  onDragStart(event: MouseEvent) {

    this.left = event.offsetX - (event.offsetX % 35);
    const pageX = event.pageX;
    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.pageX - pageX;
      requestAnimationFrame(() => {
        this.width = deltaX;
        this.service.highlighterWidth = this.width;
        this.service.highlighterLeft = this.left;
        this.cdr.markForCheck();
      });
    };
    const onMouseUp = (event: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (pageX > event.pageX) {
        this.width = 0;
        this.left = 0;
        this.cdr.markForCheck();
        return;
      }
      requestAnimationFrame(() => {
        this.width = this.width + (35 - (this.width % 35));
        this.service.highlighterWidth = this.width;
        this.service.highlighterLeft = this.left;
        this.cdr.markForCheck();
      })
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  reset() {
    this.left = 0;
    this.width = 0;
  }

}
