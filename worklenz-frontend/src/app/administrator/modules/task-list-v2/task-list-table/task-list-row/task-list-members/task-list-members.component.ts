import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {ILocalSession} from "@interfaces/api-models/local-session";

import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";
import {AuthService} from "@services/auth.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {filter} from "rxjs";
import {TaskListV2Service} from "../../../task-list-v2.service";
import {UtilsService} from "@services/utils.service";
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TaskTimerService} from "@admin/components/task-timer/task-timer.service";
import {ITimerChange} from "@admin/components/task-timer/interfaces";

@Component({
  selector: 'worklenz-task-list-members',
  templateUrl: './task-list-members.component.html',
  styleUrls: ['./task-list-members.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListMembersComponent implements OnInit, OnDestroy {
  @ViewChild('memberSearchInput', {static: false}) memberSearchInput!: ElementRef<HTMLInputElement>;
  @Input() task: IProjectTask = {};
  @HostBinding("class") cls = "flex-row task-members";

  searchText: string | null = null;
  members: ITeamMemberViewModel[] = [];

  private session: ILocalSession | null = null;

  show = false;
  isOwnerOrAdmin = false;

  get avatarClass() {
    return this.task.assignees?.length
      ? 'add-button avatar-dashed ms-1 bg-white'
      : 'avatar-dashed bg-white';
  }

  constructor(
    private readonly service: TaskListV2Service,
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
    private readonly auth: AuthService,
    private readonly utils: UtilsService,
    private readonly ngZone: NgZone,
    private readonly kanbanService: KanbanV2Service,
    private readonly timerService: TaskTimerService
  ) {
    this.service.onMembersChange$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.cdr.markForCheck();
        this.updateMembers();
      });

    this.timerService.onListTimerStop
      .pipe(takeUntilDestroyed())
      .subscribe((response: string) => {
        if(this.task.id === response) {
          this.handleMemberAssignByTimer(response);
        }
      })

    this.service.onAssignMe$
      .pipe(
        filter(value => value.id === this.task.id),
        takeUntilDestroyed()
      )
      .subscribe((value) => {
        this.handleResponse(value);
      });
  }

  ngOnInit() {
    this.session = this.auth.getCurrentSession();
    this.isOwnerOrAdmin = this.auth.isOwnerOrAdmin();
    this.updateMembers();
    this.socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.members = [];
    this.socket.removeListener(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.handleResponse);
  }

  private handleResponse = (response: ITaskAssigneesUpdateResponse) => {
    try {
      if (response && response.id === this.task.id) {
        this.task.assignees = response.assignees || [];
        this.task.names = response.names || [];
        this.cdr.markForCheck();
      }
    } catch (e) {
      // ignore
    }
  }

  private updateMembers() {
    this.members = this.service.members;
  }

  private sortMembersBySelection(members: ITeamMemberViewModel[]) {
    this.utils.sortBySelection(members);
    this.utils.sortByPending(members);
  }

  trackById(index: number, item: ITeamMemberViewModel) {
    return item.id;
  }

  handleVisibleChange(visible: boolean, tr: HTMLDivElement) {
    this.show = visible;
    visible ? tr.classList.add(this.service.HIGHLIGHT_COL_CLS) : tr.classList.remove(this.service.HIGHLIGHT_COL_CLS);
    if (visible) {
      const assignees = this.task.assignees?.map(a => a.team_member_id) || [];
      for (const member of this.members)
        member.selected = assignees.includes(member.id);
      this.focusMemberSearchInput();
    } else {
      this.searchText = null;
      for (const member of this.members)
        member.selected = false;
    }
    this.sortMembersBySelection(this.members);
  }

  private focusMemberSearchInput() {
    setTimeout(() => {
      this.memberSearchInput?.nativeElement?.focus();
    }, 100);
  }

  handleMemberChange(member: ITeamMemberViewModel, checked: boolean) {
    if (!this.session) return;
    const body = {
      team_member_id: member.id,
      project_id: this.service.getProjectId(),
      task_id: this.task.id,
      reporter_id: this.session.id,
      mode: checked ? 0 : 1,
      parent_task: this.task.parent_task_id
    };
    this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
    this.sortMembersBySelection(this.members);
  }

  handleMemberAssignByTimer(taskId: string) {
    if (!this.session) return;
    const body = {
      team_member_id: this.session.team_member_id,
      project_id: this.service.getProjectId(),
      task_id: taskId,
      reporter_id: this.session.id,
      mode: 0,
      parent_task: this.task.parent_task_id
    };
    this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
    this.sortMembersBySelection(this.members);
    this.cdr.markForCheck();
  }

  closeDropdown() {
    this.ngZone.runOutsideAngular(() => {
      document.body.click();
    });
  }

  onInviteClick() {
    document.body.click();
    this.service.emitInviteMembers();
  }

  transform(items: any[], searchTerm: string | null): any[] {
    if (!searchTerm)
      return items;

    return items.filter(item => {
      return item.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }

  selectLastValue(event: any) {
    if (!event.target.value) {
      return;
    } else {
      const filteredMembers = this.members.filter(member => member.name && member.name.toLowerCase().includes(event.target.value.toLowerCase()));
      if (filteredMembers.length == 1) {
        this.handleMemberChange(filteredMembers[0], !filteredMembers[0].selected);
        filteredMembers[0].selected = !filteredMembers[0].selected;
      }
    }
  }

}
