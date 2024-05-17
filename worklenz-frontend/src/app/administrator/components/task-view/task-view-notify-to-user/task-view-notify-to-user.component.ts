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
import {AuthService} from "@services/auth.service";
import {Socket} from "ngx-socket-io";
import {TaskViewService} from "../task-view.service";
import {InlineMember} from "@interfaces/api-models/inline-member";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {TasksApiService} from "@api/tasks-api.service";
import {SocketEvents} from "@shared/socket-events";
import {UtilsService} from "@services/utils.service";

type TaskSubscriber = InlineMember;
type TeamMember = ITeamMemberViewModel;

@Component({
  selector: 'worklenz-task-view-notify-to-user',
  templateUrl: './task-view-notify-to-user.component.html',
  styleUrls: ['./task-view-notify-to-user.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskViewNotifyToUserComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput', {static: false}) searchInput!: ElementRef<HTMLInputElement>;
  searchText: string | null = null;

  subscribers: TaskSubscriber[] = [];
  members: TeamMember[] = [];

  loadingSubscribers = false;
  loadingMembers = false;

  get loading() {
    return this.loadingSubscribers || this.loadingMembers;
  }

  constructor(
    private readonly auth: AuthService,
    private readonly membersApi: TeamMembersApiService,
    private readonly api: TasksApiService,
    private readonly socket: Socket,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    public readonly service: TaskViewService,
    private readonly utils: UtilsService,
  ) {
  }

  async ngOnInit() {
    await this.getSubscribers();
    await this.getMembers();
    this.markSubscribers();
    this.cdr.markForCheck();

    this.socket.on(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), this.handleResponse);
  }

  private async getMembers() {
    try {
      this.loadingMembers = true;
      const res = await this.membersApi.getAll();
      if (res.done) {
        this.members = res.body;
      }
      this.loadingMembers = false;
    } catch (e) {
      this.loadingMembers = false;
    }
  }

  private async getSubscribers() {
    const taskId = this.service.model.task?.id;
    if (!taskId) return;

    try {
      this.loadingSubscribers = true;
      const res = await this.api.getTaskSubscribers(taskId);
      if (res.done) {
        this.subscribers = res.body;
      }
      this.loadingSubscribers = false;
    } catch (e) {
      this.loadingSubscribers = false;
    }
  }

  private markSubscribers() {
    const subscriberIds = this.subscribers.map(s => s.team_member_id);
    for (const member of this.members) {
      member.selected = subscriberIds.includes(member.id);
    }
  }

  trackById(index: number, item: ITeamMemberViewModel) {
    return item.id;
  }

  private focusInput() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.searchInput?.nativeElement?.focus();
      }, 100); // wait for dropdown animation
    });
  }

  handleMembersVisibleChange(visible: boolean) {
    if (!this.service.model.task) return;
    if (visible) {
      this.focusInput();
      this.sortMembersBySelection(this.members);
    } else {
      this.searchText = null;
    }
  }

  handleMemberChange(item: ITeamMemberViewModel, selected: boolean) {
    const task = this.service.model.task;
    if (!task) return;
    const body = {
      team_member_id: item.id,
      task_id: task.id,
      user_id: item.user_id,
      mode: selected ? 0 : 1
    };
    this.socket.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), body);
  }

  private handleResponse = (response: TaskSubscriber[]) => {
    if (!response) return;
    this.subscribers = response;
    const task = this.service.model.task;
    if (task?.id)
      this.service.emitOnTaskSubscriberChange(task.id, response.length)
    this.sortMembersBySelection(this.members);
    this.cdr.markForCheck();
  }

  private sortMembersBySelection(members: ITeamMemberViewModel[]) {
    this.utils.sortBySelection(members);
    this.utils.sortByPending(members);
  }

}
