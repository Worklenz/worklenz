import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output
} from '@angular/core';
import {NavItem} from "@interfaces/nav-item";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {UtilsService} from "@services/utils.service";
import {AuthService} from "@services/auth.service";
import {ProfileSettingsApiService} from "@api/profile-settings-api.service";
import {NotificationSettingsService} from "@services/notification-settings.service";
import {log_error} from "@shared/utils";
import {ITeamViewModel} from "@interfaces/api-models/team-view-model";
import {TeamsApiService} from "@api/teams-api.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AdminCenterService} from "../../admin-center/admin-center-service.service";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {SettingsService} from "../../settings/settings.service";
import {Router} from "@angular/router";

enum TeamStatus {
  OwnerAndNameChanged,
  OwnerAndNameNotChanged,
  NotTheOwner
}

@Component({
  selector: 'worklenz-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  @Input() teams: ITeamViewModel[] = [];
  @Input() profile: any = {};
  @Input() navigation: NavItem[] = [];
  @Input() count = 0;

  @Input() showNotifications = false;
  @Output() showNotificationsChange = new EventEmitter<boolean>();

  // readonly BETA_INFO = `A "Beta" app generally means that people can use and test it, but they should expect bugs & issues.`;
  readonly TEAM_STATUSES = TeamStatus;

  showProfileDropdown = false;
  showTeamMemberModal = false;
  loading = false;
  switchingTeam = false;

  selectedMemberId: string | null = null;

  get avatarColor() {
    return this.utils.getColor(this.profile?.name);
  }

  get userRole() {
    return this.auth.role;
  }

  constructor(
    private readonly settingsApi: ProfileSettingsApiService,
    private readonly api: TeamsApiService,
    private readonly notificationSettings: NotificationSettingsService,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    public readonly utils: UtilsService,
    private readonly adminCenterService: AdminCenterService,
    private teamMembersApi: TeamMembersApiService,
    private settingsService: SettingsService,
    private router: Router,
  ) {
    this.notificationSettings.onCountsUpdate$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.cdr.markForCheck();
      });

    this.adminCenterService.onTeamNameChange
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.onHandleTeamNameChange(value);
      })
  }

  signOut() {
    this.auth.signOutWithConfirm();
  }

  showUnreadNotificationsCount() {
    return !!this.notificationSettings.settings.show_unread_items_count;
  }

  hasNotifications() {
    return this.notificationSettings.count > 0;
  }

  isActiveTeam(teamId?: string) {
    return teamId === this.profile?.team_id;
  }

  openNotificationsDrawer() {
    this.showNotifications = true;
    this.showNotificationsChange.emit(true);
  }

  async selectTeam(id: string | undefined) {
    if (!id) return;
    this.loading = true;
    this.switchingTeam = true;
    try {
      const res = await this.api.activate(id);
      if (res.done) {
        await this.auth.authorize();
        this.reload();
      } else {
        this.switchingTeam = false;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      this.switchingTeam = false;
      log_error(e);
    }

    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  hideProfileDropdown(event: any) {
    const classList = event.target.classList;
    if (classList.contains('prevent-default'))
      return;
    this.showProfileDropdown = false;
    this.cdr.detectChanges();
  }

  getTeamStatus(item: ITeamViewModel) {
    if (item.owner && !this.profile?.my_setup_completed) return TeamStatus.OwnerAndNameNotChanged;
    if (item.owner && this.profile?.my_setup_completed) return TeamStatus.OwnerAndNameChanged;
    return TeamStatus.NotTheOwner;
  }

  onHandleTeamNameChange(response: { teamId: string, teamName: string }) {
    if (this.profile?.team_id === response.teamId) {
      this.profile.team_name = response.teamName;
    }
    this.cdr.detectChanges();
  }

  reload() {
    window.location.reload();
  }

  reset() {
    this.selectedMemberId = null;
  }

  isOwnerOrAdmin() {
    return (this.profile?.owner || this.profile?.is_admin);
  }

  handleOnCreateOrUpdate(event: number) {
    if (event == 1) // create
    this.settingsService.emitNewMemberCreated();
  }
  openAddMemberForm() {
    this.showTeamMemberModal = true;
  }

  navigateHome() {
   this.router.navigate(['/worklenz']);
  }

}
