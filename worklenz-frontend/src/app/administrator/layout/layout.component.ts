import {AfterViewInit, Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {NavItem} from "@interfaces/nav-item";
import {AuthService} from "@services/auth.service";
import {TeamsApiService} from "@api/teams-api.service";
import {ITeamViewModel} from "@interfaces/api-models/team-view-model";
import {NavItemType} from "@interfaces/nav-item-type";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {NzMessageService} from "ng-zorro-antd/message";
import {EventMenuChanged, EventProfilePictureChange} from "@shared/events";
import {MenuService} from "@services/menu.service";
import {NzModalService} from 'ng-zorro-antd/modal';
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";
import {ProfileSettingsApiService} from "@api/profile-settings-api.service";
import {NotificationSettingsService} from "@services/notification-settings.service";
import {SocketService} from "@services/socket.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AdminCenterService} from "../admin-center/admin-center-service.service";
import {merge} from "rxjs";

@Component({
  selector: 'worklenz-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  navigation: NavItem[] = [];
  teams: ITeamViewModel[] = [];

  count = 0;
  loading = false;
  showNotifications = false;
  switchingTeam = false;
  reconnecting = false;
  updateAvailable = false;

  private messageId: string | null = null;

  get profile() {
    return this.auth.getCurrentSession();
  }

  constructor(
    private readonly auth: AuthService,
    private readonly api: TeamsApiService,
    private readonly socket: Socket,
    private readonly message: NzMessageService,
    private readonly menu: MenuService,
    private readonly modal: NzModalService,
    private readonly socketService: SocketService,
    private readonly settingsApi: ProfileSettingsApiService,
    private readonly notificationSettings: NotificationSettingsService,
    public readonly utils: UtilsService,
    private readonly adminCenterService: AdminCenterService
  ) {
    this.socket.connect();

    merge(this.adminCenterService.onCreateTeam, this.adminCenterService.onTeamNameChange)
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.getTeams();
      });
  }

  ngOnInit() {
    void this.getTeams();
    void this.getNotificationSettings();
    this.listeningForSocketEvents();
  }

  async ngAfterViewInit() {
    await this.auth.authorize();
    this.buildNavigation();
  }

  ngOnDestroy() {
    this.socket.disconnect();
  }

  reload() {
    window.location.reload();
  }

  private listeningForSocketEvents() {
    this.socket.on("connect", () => {
      this.displayReconnectedMessage();
      this.socket.emit(SocketEvents.LOGIN.toString(), this.profile?.id);
      this.socket.once(SocketEvents.LOGIN.toString(), () => {
        this.socketService.emitSocketLoginSuccess();
      });
      this.socketService.emitSocketConnect();
    });

    this.socket.on("disconnect", () => {
      this.displayDisconnectedMessage();
      this.socket.emit(SocketEvents.LOGOUT.toString(), this.profile?.id);
      this.socketService.emitSocketDisconnect();
    });

    this.socket.on(SocketEvents.INVITATIONS_UPDATE.toString(), (message: string) => {
      void this.getTeams();
    });

    this.socket.on(SocketEvents.TEAM_MEMBER_REMOVED.toString(), (data: { teamId: string; message: string; }) => {
      if (!data) return;
      void this.getTeams();
      if (this.profile?.team_id === data.teamId) {
        this.modal.confirm({
          nzTitle: 'You no longer have permissions to stay on this team!',
          nzContent: data.message,
          nzClosable: false,
          nzCancelDisabled: true,
          nzOnOk: () => this.reload()
        });
      }
    });
  }

  private async getTeams() {
    try {
      this.loading = true;
      const res = await this.api.get();
      if (res.done) {
        this.teams = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
  }

  @HostListener(`document:${EventMenuChanged}`)
  private buildNavigation() {
    const navigation: NavItem[] = [];
    navigation.push({label: "Home", icon: "appstore", url: 'home', type: NavItemType.MenuItem});
    navigation.push({label: "Projects", icon: "project", url: 'projects', type: NavItemType.MenuItem});

    if (this.profile?.owner || this.profile?.is_admin) {
      navigation.push({label: "Schedule", icon: "team", url: 'schedule', type: NavItemType.MenuItem});
      navigation.push({label: "Reporting", icon: "team", url: 'reporting', type: NavItemType.MenuItem});

      if (this.menu.isPinned(this.menu.CLIENTS_MENU))
        navigation.push({label: "Clients", icon: "team", url: 'settings/clients', type: NavItemType.MenuItem});
      if (this.menu.isPinned(this.menu.JOB_TITLES_MENU))
        navigation.push({
          label: "Job Titles",
          icon: "team",
          url: 'settings/job-titles',
          type: NavItemType.MenuItem
        });
      if (this.menu.isPinned(this.menu.TEAMS_MENU))
        navigation.push({label: "Teams", icon: "team", url: 'settings/teams', type: NavItemType.MenuItem});
      if (this.menu.isPinned(this.menu.LABELS_MENU))
        navigation.push({label: "Labels", icon: "tags", url: 'settings/labels', type: NavItemType.MenuItem});
      if (this.menu.isPinned(this.menu.TASK_STATUSES_MENU))
        navigation.push({
          label: "Task Statuses",
          icon: "team",
          url: 'settings/statuses',
          type: NavItemType.MenuItem
        });
    }

    this.navigation = [...navigation];
  }

  private async getNotificationSettings() {
    try {
      const res = await this.settingsApi.getNotificationSettings();
      if (res.done) {
        this.notificationSettings.settings = res.body;
      }
    } catch (e) {
      // ignored
    }
  }

  private displayReconnectedMessage() {
    if (this.messageId) {
      this.message.remove(this.messageId);
      this.message.success("Connected to the server.", {nzDuration: 2000});
      this.messageId = null;
      void this.checkForUpdates();
      this.reconnecting = false;
    }
  }

  @HostListener(`document:${EventProfilePictureChange}`)
  public async checkForUpdates() {
    await this.auth.authorize();
    const key = "worklenz-build-version";
    const v = this.profile?.build_v || null;
    const storedVersion = localStorage.getItem(key);

    if (storedVersion == null && v) {
      localStorage.setItem(key, v);
      this.updateAvailable = false;
      return false;
    }

    this.updateAvailable = !!(v && v !== storedVersion);
    if (this.updateAvailable) {
      localStorage.setItem(key, v as string);
    }

    return this.updateAvailable;
  }

  private displayDisconnectedMessage() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.message.error("You are disconnected from the server!", {nzDuration: 1500});
    this.messageId = this.message.loading("Trying to reconnect...", {nzDuration: 0}).messageId;
  }
}
