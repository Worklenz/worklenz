import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";
import {AuthService} from "@services/auth.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {TaskListV2Service} from "../../../modules/task-list-v2/task-list-v2.service";
import {ProjectsService} from "../../../projects/projects.service";
import {TaskViewService} from "../task-view.service";
import {UtilsService} from "@services/utils.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {
  ProjectScheduleService
} from "../../../schedule/schedule-v2/projects-schedule/service/project-schedule-service.service";

@Component({
  selector: 'worklenz-task-view-assignees',
  templateUrl: './task-view-assignees.component.html',
  styleUrls: ['./task-view-assignees.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewAssigneesComponent implements OnInit, OnDestroy {
  @ViewChild('memberSearchInput', {static: false}) memberSearchInput!: ElementRef<HTMLInputElement>;
  searchText: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly projectsService: ProjectsService,
    private readonly socket: Socket,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    public readonly service: TaskViewService,
    public readonly list: TaskListV2Service,
    private readonly utils: UtilsService,
  ) {
    this.service.onTimeLogAssignMember
      .pipe(takeUntilDestroyed())
      .subscribe( (response: ITaskAssigneesUpdateResponse) => {
        this.handleResponse(response);
    })
  }

  ngOnInit() {
    this.socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.handleResponse);
  }

  handleMembersVisibleChange(visible: boolean) {
    if (!this.service.model.task) return;

    const members = [...this.list.members];

    if (visible) {
      const assignees = this.service.model.task.assignees as string[];
      for (const member of members) {
        if (member.id)
          member.selected = assignees.includes(member.id);
      }
      this.focusMemberSearchInput();
    } else {
      this.searchText = null;
      for (const member of members)
        member.selected = false;
    }

    this.list.members = members;
    this.sortMembersBySelection(this.list.members);
    this.cdr.markForCheck();
  }

  private focusMemberSearchInput() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.memberSearchInput?.nativeElement?.focus();
      }, 100);
    });
  }

  handleMemberChange(item: ITeamMemberViewModel, assign: boolean) {
    const task = this.service.model.task;
    if (!task) return;
    const session = this.auth.getCurrentSession();
    const body = {
      team_member_id: item.id,
      project_id: this.projectsService.id,
      task_id: task.id,
      reporter_id: session?.id,
      mode: assign ? 0 : 1,
      parent_task: task.parent_task_id
    };
    this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
    if (item.id) this.service.emitSingleMemberChange(item.id);
  }

  trackById(index: number, item: ITeamMemberViewModel) {
    return item.id;
  }

  private handleResponse = (response: ITaskAssigneesUpdateResponse) => {
    if (!this.service.model.task) return;
    try {
      if (response) {
        this.service.model.task.assignees = (response.assignees || []).map(m => m.team_member_id);
        this.service.model.task.names = response.names || [];
        this.service.emitRefresh(response.id);
        this.service.emitAssigneesChange();
        if (this.list.isSubtasksIncluded) {
          this.list.emitRefreshSubtasksIncluded();
        }
        this.sortMembersBySelection(this.list.members);
        this.cdr.markForCheck();
      }
    } catch (e) {
      // ignore
    }
  }

  private sortMembersBySelection(members: ITeamMemberViewModel[]) {
    this.utils.sortBySelection(members);
    this.utils.sortByPending(members);
  }

}
