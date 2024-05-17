import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  ViewChild
} from '@angular/core';
import {IAcceptTeamInvite} from "@interfaces/team";
import {TeamsApiService} from "@api/teams-api.service";
import {Router} from "@angular/router";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {NotificationsApiService} from "@api/notifications-api.service";
import {ITeamInvitationViewModel} from "@interfaces/api-models/team-invitation-view-model";
import {AuthService} from "@services/auth.service";
import {log_error, toQueryString} from "@shared/utils";
import {NotificationSettingsService} from "@services/notification-settings.service";
import {NotificationTemplateComponent} from "./notification-template/notification-template.component";
import {IWorklenzNotification} from "@interfaces/worklenz-notification";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {IInvitationResponse} from "@interfaces/invitation-response";
import {NotificationsDataModel} from "./types";
import {HTML_TAG_REGEXP} from "@shared/constants";

@Component({
  selector: 'worklenz-notifications-drawer',
  templateUrl: './notifications-drawer.component.html',
  styleUrls: ['./notifications-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsDrawerComponent implements OnInit, OnDestroy {
  @ViewChild("template", {static: false}) notificationTemplate!: NotificationTemplateComponent;

  @Input() show = false;
  @Output() showChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  @Input() count = 0;
  @Output() countChange: EventEmitter<number> = new EventEmitter<number>();

  readonly OPTION_UNREAD = "Unread";
  readonly OPTION_READ = "Read";
  readonly options = [this.OPTION_UNREAD, this.OPTION_READ];

  private invitations: ITeamInvitationViewModel[] = [];
  private notifications: IWorklenzNotification[] = [];
  private showBrowserPush = false;
  private session: ILocalSession | null = null;
  private _dataset: NotificationsDataModel = [];

  loading = false;
  loadingInvitations = false;
  activatingTeam = false;
  acceptingInvitation = false;
  accepting = false;
  joining = false;
  readAllInProgress = false;

  invitationsCount = 0;
  notificationsCount = 0;
  unreadNotificationsCount = 0;

  selectedFilter = this.OPTION_UNREAD;

  dataset: NotificationsDataModel = [];
  loadersMap: { [x: string]: boolean } = {};

  get title() {
    return `${this.selectedFilter} Notifications (${this.dataset.length})`;
  }

  constructor(
    private readonly api: TeamsApiService,
    private readonly notificationsApi: NotificationsApiService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly socket: Socket,
    private readonly settingsService: NotificationSettingsService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly renderer: Renderer2,
    private readonly teamApi: TeamsApiService
  ) {
    this.askPushPerm();
    this.session = this.auth.getCurrentSession();
  }

  ngOnInit() {
    void this.init();
    this.socket.on(SocketEvents.INVITATIONS_UPDATE.toString(), this.onInvitationsUpdate);
    this.socket.on(SocketEvents.NOTIFICATIONS_UPDATE.toString(), this.onNotificationsUpdate);
    this.socket.on(SocketEvents.TEAM_MEMBER_REMOVED.toString(), this.onInvitationDelete);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.INVITATIONS_UPDATE.toString(), this.onInvitationsUpdate);
    this.socket.removeListener(SocketEvents.NOTIFICATIONS_UPDATE.toString(), this.onNotificationsUpdate);
    this.socket.removeListener(SocketEvents.TEAM_MEMBER_REMOVED.toString(), this.onInvitationDelete);
  }

  private async init() {
    this.dataset = [];
    this._dataset = [];
    await this.getInvites();
    await this.getNotifies();
    await this.getUnreadCount();
    this.sortDataset();
    this.dataset = [...this._dataset];
    this.cdr.markForCheck();
  }

  @HostListener("document:visibilitychange")
  private onFocusChange() {
    this.ngZone.runOutsideAngular(() => {
      this.showBrowserPush = document.visibilityState === "hidden";
    });
  }

  private sortDataset() {
    const invitation = "invitation";
    this._dataset.sort((a, b) => {
      if (a.type === invitation && b.type !== invitation) return -1;
      if (a.type !== invitation && b.type === invitation) return 1;
      return 0;
    });
  }

  async selectTeam(id: string | undefined) {
    if (!id) return;
    this.activatingTeam = true;
    try {
      const res = await this.api.activate(id);
      if (res.done) {
        await this.router.navigate(['/worklenz']);
      }
      this.activatingTeam = false;
    } catch (e) {
      this.activatingTeam = false;
      log_error(e);
    }
  }

  closeDrawer() {
    this.show = false;
    this.showChange.emit(false);
  }

  isUnreadNotifications() {
    return this.selectedFilter === this.OPTION_UNREAD;
  }

  inProgress() {
    return this.accepting || this.joining || this.acceptingInvitation || this.activatingTeam;
  }

  trackByFn(index: number, item: any) {
    return item.id;
  }

  isEmpty() {
    return (this.invitationsCount + this.notificationsCount) === 0;
  }

  private askPushPerm() {
    if('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      // The user hasn't been asked for permission yet
      if (Notification.permission === "default") {
          this.ngZone.runOutsideAngular(() => {
            // Let's check if the browser supports notifications
            if (!('Notification' in window)) {
              console.log("This browser does not support notifications.");
              return;
            }
            void Notification.requestPermission();
          });
      }
    } else {
      console.log("This browser does not support notification permission.");
      return;
    }
  }

  async accept(event: MouseEvent, item?: ITeamInvitationViewModel) {
    if (!item) return;
    const res = await this.acceptInvite(item.team_member_id, false);
    if (res) {
      this.markNotificationAsRead(event, item.id)
      await this.init();
    }
    this.cdr.markForCheck();
  }

  async acceptAndJoin(item?: ITeamInvitationViewModel) {
    if (!item) return;
    this.joining = true;
    item.joining = true;

    this.cdr.detectChanges();

    const res = await this.acceptInvite(item.team_member_id, true);
    if (res) {
      void this.init();
      await this.selectTeam(res.id);
      await this.auth.authorize();
      this.closeDrawer();
      window.location.reload();
    }
    item.joining = false;
    this.joining = false;

    this.cdr.markForCheck();
  }

  async readAll() {
    try {
      this.readAllInProgress = true;

      this.cdr.detectChanges();

      const res = await this.notificationsApi.readAll();
      if (res) {
        await this.init();
      }
      this.readAllInProgress = false;
    } catch (e) {
      this.readAllInProgress = false;
    }

    this.cdr.markForCheck();
  }

  private async getInvites() {
    try {
      this.loadingInvitations = true;
      const res = await this.api.getInvites();
      if (res.done) {
        this.invitations = res.body;
        this.invitationsCount = this.invitations.length;
        for (const item of this.invitations) {
          this._dataset.push({type: "invitation", data: item});
        }
      }
      this.loadingInvitations = false;
    } catch (e) {
      this.loadingInvitations = false;
      log_error(e);
    }
  }

  private async getNotifies() {
    try {
      this.loading = true;
      const res = await this.notificationsApi.get(this.selectedFilter);
      if (res.done) {
        this.notifications = res.body;
        this.notificationsCount = this.notifications.length;
        this.settingsService.count = this.notificationsCount;

        for (const item of this.notifications) {
          this._dataset.push({type: "notification", data: item});
        }
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
  }

  private async getUnreadCount() {
    try {
      const res = await this.notificationsApi.getUnreadCount();
      if (res.done) {
        this.unreadNotificationsCount = res.body;
        this.emitCountChange();
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
    }
    this.cdr.markForCheck();
  }

  private async acceptInvite(teamMemberId?: string, showAlert?: boolean) {
    if (!teamMemberId) return;
    try {
      this.acceptingInvitation = true;
      const body: IAcceptTeamInvite = {
        team_member_id: teamMemberId,
        show_alert: showAlert
      };
      const res = await this.api.accept(body);
      this.acceptingInvitation = false;
      if (res.done && res.body.id) {
        return res.body;
      }
    } catch (e) {
      this.acceptingInvitation = false;
      log_error(e);
    }
    return null;
  }

  private emitCountChange() {
    this.countChange.emit(this.unreadNotificationsCount);
    this.settingsService.emitCountsUpdate();
  }

  handleVisibilityChange(visible: boolean) {
    this.ngZone.runOutsideAngular(() => {
      if (visible) {
        this.renderer.setStyle(document.documentElement, "overflow", "hidden");
      } else {
        this.renderer.removeStyle(document.documentElement, "overflow");
      }
    });
  }

  async markNotificationAsRead(event: MouseEvent, id?: string) {
    event.stopPropagation();
    if (!id) return;
    this.loadersMap[id] = true;
    const res = await this.notificationsApi.update(id);
    if (res) {
      this.notificationsCount--;
      this.dataset.splice(this.dataset.findIndex(n => n.data.id === id), 1);
      this._dataset.splice(this._dataset.findIndex(n => n.data.id === id), 1);
    }
    this.loadersMap[id] = false;
    this.getUnreadCount();
    this.cdr.markForCheck();
  }

  async goToUrl(event: MouseEvent, notification: IWorklenzNotification) {
    event.stopPropagation();
    if (notification.url) {
      this.closeDrawer();

      if (this.session?.team_id !== notification.team_id) {
        await this.teamApi.activate(notification.team_id);
        await this.auth.authorize();
      }

      if (notification.project && notification.task_id)
        this.settingsService.emitNotificationClick({
          project: notification.project,
          task: notification.task_id
        });

      void this.router.navigate([notification.url], {
        queryParams: notification.params || null
      });

      this.cdr.markForCheck();

    }
  }

  private isPushEnabled() {
    return !!this.settingsService.settings.popup_notifications_enabled;
  }

  private createPush(message: string, title: string, teamId: string | null, url?: string) {
    if (Notification.permission === "granted" && this.showBrowserPush) {
      this.ngZone.runOutsideAngular(() => {
        const img = 'https://worklenz.com/assets/icons/icon-128x128.png';
        new Notification(title, {
          body: message.replace(HTML_TAG_REGEXP, ''),
          icon: img,
          badge: img
        }).onclick = async (event) => {
          if (url) {
            window.focus();

            if (teamId && this.session?.team_id !== teamId) {
              await this.teamApi.activate(teamId);
              await this.auth.authorize();
            }

            window.location.href = url;
          }
        };
      });
    }
  }

  private onInvitationsUpdate = async (response: IInvitationResponse) => {
    if (this.isPushEnabled()) {
      this.createPush(response.message, response.team, response.team_id);
      this.notificationTemplate.show({
        id: "",
        team: response.team,
        team_id: response.team_id,
        message: response.message,
      });
    }
    void this.init();
  }

  private onInvitationDelete = async (response: any) => {
    void this.init();
    this.getUnreadCount();
  }

  private onNotificationsUpdate = (notification: IWorklenzNotification) => {
    if (this.isPushEnabled()) {
      const title = notification.team ? `${notification.team} | Worklenz` : "Worklenz";

      let url = notification.url;
      if (url && notification.params && Object.keys(notification.params).length) {
        const q = toQueryString(notification.params);
        url += q;
      }

      this.createPush(notification.message, title, notification.team_id, url);
      this.notificationTemplate.show(notification);
    }

    void this.init();
  }

  onOptionChange(index: number) {
    this.selectedFilter = this.options[index];
    this.loading = true;
    void this.init();
  }
}
