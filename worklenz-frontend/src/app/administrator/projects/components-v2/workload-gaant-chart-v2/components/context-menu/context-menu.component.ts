import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, ViewChild} from '@angular/core';
import {ITaskListContextMenuEvent, ITaskListGroup} from "../../../../../modules/task-list-v2/interfaces";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {Subject, takeUntil} from "rxjs";
import {NzContextMenuService, NzDropdownMenuComponent} from "ng-zorro-antd/dropdown";
import {Socket} from "ngx-socket-io";
import {WlTasksService} from "../../services/wl-tasks.service";
import {WlTasksHashMapService} from "../../services/wl-tasks-hash-map.service";
import {SocketEvents} from "@shared/socket-events";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {smallId} from "@shared/utils";
import {AuthService} from "@services/auth.service";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";

@Component({
  selector: 'worklenz-wl-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WLContextMenuComponent {
  @ViewChild('contextMenuDropdown', {static: false}) contextMenuDropdown!: NzDropdownMenuComponent;
  @Input({required: true}) projectId: string | null = null;
  @Input({required: true}) teamMemberId: string | null = null;
  @Input() groups: ITaskListGroup[] = [];

  protected removing = false;

  selectedTask: IProjectTask | null = null;

  protected readonly id = smallId(4);

  private readonly _session: ILocalSession | null = null;

  get profile() {
    return this.auth.getCurrentSession();
  }

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly contextMenuService: NzContextMenuService,
    private readonly service: WlTasksService,
    private readonly map: WlTasksHashMapService,
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
  ) {
    this.service.onContextMenu$
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.onContextMenu(value);
      });
    this._session = this.auth.getCurrentSession();
  }

  private onContextMenu(value: ITaskListContextMenuEvent) {
    this.selectedTask = value.task;
    this.map.deselectAll();
    this.map.selectTask(value.task);
    this.cdr.detectChanges();
    this.contextMenuService.create(value.event, this.contextMenuDropdown);
  }

  removeMember() {
    if (!this._session || !this.selectedTask || !this.teamMemberId) return
    const body = {
      team_member_id: this.teamMemberId,
      project_id: this.projectId,
      task_id: this.selectedTask.id,
      reporter_id: this._session.id,
      mode: 1,
      parent_task: this.selectedTask.parent_task_id
    };
    this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
    this.socket.once(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), () => {
      this.service.emitRemoveMembersTask(body.task_id as string);
    })
  }

  handleMemberChangeResponse = (response: ITaskAssigneesUpdateResponse) => {
    try {
      if (response && response.id) {
        this.service.deleteTask(response.id)
        this.cdr.markForCheck();
      }
    } catch (e) {
      // ignore
    }
  }

  changeGroup(toGroupId: string) {
    if (!this.selectedTask) return;
    const groupBy = this.service.getCurrentGroup();
    if (groupBy.value === this.service.GROUP_BY_STATUS_VALUE) {
      this.handleStatusChange(toGroupId, this.selectedTask.id);
    } else if (groupBy.value === this.service.GROUP_BY_PRIORITY_VALUE) {
      this.handlePriorityChange(toGroupId, this.selectedTask.id);
    } else if (groupBy.value === this.service.GROUP_BY_PHASE_VALUE) {
      this.handlePhaseChange(toGroupId, this.selectedTask.id);
    }
  }

  handleStatusChange(statusId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      status_id: statusId,
team_id: this.auth.getCurrentSession()?.team_id
    }));
    if (this.service.getCurrentGroup().value === this.service.GROUP_BY_STATUS_VALUE && this.selectedTask) {
      this.service.updateTaskGroup(this.selectedTask, false);
      if (this.service.isSubtasksIncluded) {
        this.service.emitRefreshSubtasksIncluded();
      }
    }
    this.cdr.markForCheck();
  }

  handlePriorityChange(priorityId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), JSON.stringify({
      task_id: taskId,
      priority_id: priorityId
    }));
    if (this.service.getCurrentGroup().value === this.service.GROUP_BY_PRIORITY_VALUE && this.selectedTask) {
      this.service.updateTaskGroup(this.selectedTask, false);
      if (this.service.isSubtasksIncluded) {
        this.service.emitRefreshSubtasksIncluded();
      }
    }
    this.cdr.markForCheck();
  }

  handlePhaseChange(phaseId: string, taskId?: string) {
    if (!taskId) return;
    this.socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      task_id: taskId,
      phase_id: phaseId
    });
    if (this.service.getCurrentGroup().value === this.service.GROUP_BY_PHASE_VALUE && this.selectedTask) {
      this.service.updateTaskGroup(this.selectedTask, false);
      if (this.service.isSubtasksIncluded) {
        this.service.emitRefreshSubtasksIncluded();
      }
    }
    this.cdr.markForCheck();
  }
}
