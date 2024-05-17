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
import {ITeamMemberViewModel} from '@interfaces/api-models/team-members-get-response';
import {ITaskAssignee} from '@interfaces/task';
import {ITaskAssigneesUpdateResponse} from '@interfaces/task-assignee-update-response';
import {AuthService} from '@services/auth.service';
import {SocketEvents} from '@shared/socket-events';
import {TaskListV2Service} from 'app/administrator/modules/task-list-v2/task-list-v2.service';
import {ProjectsService} from 'app/administrator/projects/projects.service';
import {Socket} from 'ngx-socket-io';
import {KanbanV2Service} from '../../../kanban-view-v2.service';
import {UtilsService} from '@services/utils.service';

@Component({
  selector: 'worklenz-kanban-task-creation-assignees',
  templateUrl: './task-creation-assignees.component.html',
  styleUrls: ['./task-creation-assignees.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskCreationAssigneesComponent implements OnInit, OnDestroy {
  @ViewChild('memberSearchInput', {static: false}) memberSearchInput!: ElementRef<HTMLInputElement>;
  searchText: string | null = null;
  isOwnerOrAdmin = false;

  constructor(
    private readonly auth: AuthService,
    private readonly projectsService: ProjectsService,
    private readonly socket: Socket,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    public readonly service: KanbanV2Service,
    public readonly taskListService: TaskListV2Service,
    private readonly utils: UtilsService
  ) {
  }

  ngOnInit() {
    this.isOwnerOrAdmin = this.auth.isOwnerOrAdmin();
    this.socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.handleResponse);
  }

  private sortMembersBySelection(members: ITeamMemberViewModel[]) {
    this.utils.sortBySelection(members);
    this.utils.sortByPending(members);
  }

  handleMembersVisibleChange(visible: boolean) {
    if (!this.service.model.task) return;

    const members = [...this.taskListService.members];
    if (visible) {
      const assignees = (this.service.model.task.assignees as ITaskAssignee[])?.map(a => a.team_member_id) || [];
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
    this.taskListService.members = members;

    // if (visible) {
    //   const assignees = (this.service.model.task.assignees as ITaskAssignee[])?.map(a => a.team_member_id) || [];
    //   for (const member of this.taskListService.members)
    //     member.selected = assignees.includes(member.id);
    //   this.focusMemberSearchInput();
    // } else {
    //   this.searchText = null;
    //   for (const member of this.taskListService.members)
    //     member.selected = false;
    // }
    //
    // this.taskListService.members = members;

    this.sortMembersBySelection(this.taskListService.members);
    this.cdr.markForCheck();
  }

  private focusMemberSearchInput() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.memberSearchInput?.nativeElement?.focus();
      }, 100);
    });
  }

  handleMemberChange(item: ITeamMemberViewModel, checked: boolean) {
    const task = this.service.model.task;
    if (!task) return;
    const session = this.auth.getCurrentSession();
    const body = {
      team_member_id: item.id,
      project_id: this.projectsService.id,
      task_id: task.id,
      reporter_id: session?.id,
      mode: checked ? 0 : 1,
      parent_task: task.parent_task_id
    };
    this.socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
  }

  trackById(index: number, item: ITeamMemberViewModel) {
    return item.id;
  }

  private handleResponse = (response: ITaskAssigneesUpdateResponse) => {
    if (!this.service.model.task) return;
    try {
      if (response) {
        this.service.emitOnAssignMembers(response);
        this.service.model.task.assignees = response.assignees || [];
        this.service.model.task.names = response.names || [];
        this.service.emitRefresh(response.id);
        this.sortMembersBySelection(this.taskListService.members);
        this.cdr.markForCheck();
      }
    } catch (e) {
      // ignore
    }
  }

  onInviteClick() {
    document.body.click();
    this.taskListService.emitInviteMembers();
  }

  closeDropdown() {
    this.ngZone.runOutsideAngular(() => {
      document.body.click();
    });
  }

  selectLastValue(event: any) {
    if (!event.target.value) {
      return;
    } else {
      const filteredMembers = this.taskListService.members.filter(member => member.name && member.name.toLowerCase().includes(event.target.value.toLowerCase()));
      if (filteredMembers.length == 1) {
        this.handleMemberChange(filteredMembers[0], !filteredMembers[0].selected);
        filteredMembers[0].selected = !filteredMembers[0].selected;
      }
    }
  }

}
