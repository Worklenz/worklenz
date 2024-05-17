import {Component} from '@angular/core';
import {AvatarNamesMap, DEFAULT_PAGE_SIZE} from "@shared/constants";
import {FormArray, FormBuilder, FormGroup, Validators} from "@angular/forms";
import {AccountCenterApiService} from "@api/account-center-api.service";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {isValidateEmail, log_error} from "@shared/utils";
import {IOrganizationTeam, IOrganizationTeamMember, IOrganizationUser} from "@interfaces/account-center";
import {AppService} from "@services/app.service";
import {TeamsApiService} from "@api/teams-api.service";
import {AdminCenterService} from "../admin-center-service.service";
import {ITeamMemberCreateRequest} from "@interfaces/api-models/team-member-create-request";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {ProjectMembersApiService} from "@api/project-members-api.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss']
})
export class TeamsComponent {
  visible = false;
  visibleNewTeam = false;
  teams: IOrganizationTeam[] = [];
  currentTeam: IOrganizationTeam | null = null;

  loading = false;

  // Table sorting & pagination
  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;

  form!: FormGroup;
  editTeamForm!: FormGroup;
  searchForm!: FormGroup;

  loadingTeamDetails = false;
  teamData: IOrganizationTeam = {};
  selectedTeam: IOrganizationTeam = {};
  updatingTeam = false;

  users: IOrganizationUser[] = []
  totalUsers = 0;

  searchingName: string | null = null;
  projectId: string | null = null;
  inviting = false;

  get buttonText() {
    return this.isValueIsAnEmail() ? 'Invite as a member' : 'Invite a new member by email';
  }

  constructor(
    private readonly api: AccountCenterApiService,
    private readonly teamMembersApi: TeamMembersApiService,
    private readonly teamsApiService: TeamsApiService,
    private fb: FormBuilder,
    private app: AppService,
    private readonly service: AdminCenterService,
    private readonly membersApi: ProjectMembersApiService,
    private readonly auth: AuthService
  ) {
    this.app.setTitle("Admin Center - Teams");
    this.form = this.fb.group({
      name: [null, [Validators.required]]
    });
    this.editTeamForm = this.fb.group({
      name: [null, [Validators.required]],
      teamMembers: this.fb.array([]),
      search: [null]
    });
    this.searchForm = this.fb.group({search: []});
    this.searchForm.valueChanges.subscribe(() => this.getTeams());
    this.editTeamForm.controls["search"]?.valueChanges.subscribe((value) => this.handleMemberSelect(value));
  }

  get teamMembers() {
    return <FormArray>this.editTeamForm.get('teamMembers');
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    const currentSort = sort.find(item => item.value !== null);

    this.sortField = (currentSort && currentSort.key) || null;
    this.sortOrder = (currentSort && currentSort.value) || null;

    await this.getTeams();
  }

  async getTeams() {
    try {
      this.loading = true;
      const res = await this.api.getOrganizationTeams(this.pageIndex, this.pageSize, this.sortField, this.sortOrder, this.searchForm.value.search);
      if (res.done) {
        this.total = res.body.total || 0;
        this.teams = res.body.data?.filter(t => t.id !== this.auth.getCurrentSession()?.team_id) || [];
        this.currentTeam = res.body.current_team_data || null;
        this.loading = false;
      }
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
  }

  async createTeam() {
    if (!this.form.value || !this.form.value.name || this.form.value.name.trim() === "") return;
    try {
      if (this.form.valid) {
        this.loading = true;
        const res = await this.teamsApiService.create({name: this.form.value.name});
        if (res.done) {
          this.closeNewTeam();
          void this.getTeams();
          this.service.emitCreateTeam();
        }
      } else {
        this.app.displayErrorsOf(this.form);
      }
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
    this.loading = false;
  }

  async openTeamDrawer(team: IOrganizationTeam) {
    if (!team.id) return;
    try {
      this.loadingTeamDetails = true;
      this.selectedTeam = team;

      this.getTeamMembers(team);
    } catch (e) {
      this.loadingTeamDetails = false;
      log_error(e);
    }
    this.visible = true;
  }

  async getTeamMembers(team: IOrganizationTeam) {
    if (!team.id) return;
    try {
      const res = await this.api.getOrganizationTeam(team.id);
      if (res.done) {
        this.teamMembers.clear();
        this.teamData = res.body;
        this.total = this.teamData.team_members?.length || 0;

        this.editTeamForm.patchValue({name: this.teamData.name});
        if (this.teamData.team_members?.map((member: IOrganizationTeamMember) => {
          const tempForm = this.fb.group({
            id: member.id,
            user_id: member.user_id,
            name: member.name,
            role_name: member.role_name,
            avatar_url: member.avatar_url
          });
          this.teamMembers.push(tempForm);
        }))
          this.loadingTeamDetails = false;
      }
    } catch (e) {
      this.loadingTeamDetails = false;
    }
  }

  close(): void {
    this.teamMembers.clear();
    this.editTeamForm.reset();
    this.visible = false;
  }

  openNewTeam() {
    this.visibleNewTeam = true;
  }

  closeNewTeam() {
    this.visibleNewTeam = false;
    this.form.reset();
  }

  async submit() {
    if (!this.teamData.id) return;

    if (!this.editTeamForm.value || !this.editTeamForm.value.name || this.editTeamForm.value.name.trim() === "") return;

    try {
      this.updatingTeam = true;
      const res = await this.api.updateTeam(this.teamData.id, this.editTeamForm.value);
      if (res.done) {
        this.service.emitTeamNameChange({teamId: this.teamData.id, teamName: this.editTeamForm.value.name});
        this.close();
        void this.getTeams();
      }
    } catch (e) {
      log_error(e);
    }
  }

  async deleteTeam(id: string | undefined) {
    if (!id) return;
    try {
      const res = await this.api.deleteTeam(id);
      if (res.done) {
        await this.getTeams();
      }
    } catch (e) {
      log_error(e);
    }
  }

  async handleMemberSelect(value: string) {
    if (!value || !this.selectedTeam.id) return;
    if (this.editTeamForm.valid) {
      try {
        this.loading = true;
        const body: ITeamMemberCreateRequest = {
          job_title: null,
          emails: [value],
          is_admin: false
        };

        const res = await this.teamMembersApi.addTeamMember(this.selectedTeam.id, body);
        if (res.done) {
          this.editTeamForm.controls["search"]?.setValue(null);
          this.getTeamMembers(this.selectedTeam);
        }
        this.loading = false;
      } catch (e) {
        log_error(e);
        this.loading = false;
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }

  async deleteTeamMember(id: string | undefined) {
    if (!id || !this.selectedTeam.id) return;
    try {
      const res = await this.api.removeTeamMember(id, this.selectedTeam.id);
      if (res.done) {
        if (id === this.auth.getCurrentSession()?.team_member_id) {
          window.location.reload();
        } else {
          await this.getTeamMembers(this.selectedTeam);
        }
      }
    } catch (e) {
      log_error(e);
    }
  }

  isValueIsAnEmail() {
    if (!this.searchingName) return false;
    return isValidateEmail(this.searchingName);
  }

  async sendInvitation() {
    if (!this.projectId) return;
    if (typeof this.searchingName !== "string" || !this.searchingName.length) return;

    try {
      const email = this.searchingName.trim().toLowerCase();
      const request = {
        project_id: this.projectId,
        email
      };
      this.inviting = true;
      const res = await this.membersApi.createByEmail(request);
      this.inviting = false;
      if (res.done) {
        // this.resetSearchInput();
      }
    } catch (e) {
      this.inviting = false;
    }
  }

}
