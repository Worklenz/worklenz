import {Component} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {NzTableQueryParams} from "ng-zorro-antd/table";

import {TeamMembersApiService} from '@api/team-members-api.service';
import {JobTitlesApiService} from '@api/job-titles-api.service';
import {AppService} from '@services/app.service';
import {AuthService} from '@services/auth.service';
import {IPaginationComponent} from "@interfaces/pagination-component";
import {ITeamMembersViewModel} from "@interfaces/api-models/team-members-view-model";
import {Router} from "@angular/router";
import {AvatarNamesMap, DEFAULT_PAGE_SIZE} from "@shared/constants";
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {SettingsService} from "../settings.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-team-members',
  templateUrl: './team-members.component.html',
  styleUrls: ['./team-members.component.scss']
})
export class TeamMembersComponent implements IPaginationComponent {
  searchForm!: FormGroup;

  model: ITeamMembersViewModel = {};

  showTeamMemberModal = false;
  loading = false;

  selectedMemberId: string | null = null;

  // Table sorting & pagination
  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;

  constructor(
    private auth: AuthService,
    private api: TeamMembersApiService,
    private jobTitlesApi: JobTitlesApiService,
    private fb: FormBuilder,
    private app: AppService,
    private router: Router,
    private utilsService: UtilsService,
    private settingsService: SettingsService
  ) {
    this.app.setTitle('Team Members');

    this.searchForm = this.fb.group({
      search: [],
    });
    this.searchForm.valueChanges.subscribe(() => {
      this.search();
    });
    this.settingsService.onNewMemberCreated.pipe(takeUntilDestroyed()).subscribe(() => {
      this.getTeamMembers();
    })
  }

  get profile() {
    return this.auth.getCurrentSession();
  }

  async getTeamMembers() {
    try {
      this.loading = true;
      const res = await this.api.get(this.pageIndex, this.pageSize, this.sortField, this.sortOrder, this.searchForm.value.search);
      if (res.done) {
        this.model = res.body;
        this.total = this.model.total || 0;

        this.utilsService.handleLastIndex(this.total, this.model.data?.length || 0, this.pageIndex,
          index => {
            this.pageIndex = index;
            this.getTeamMembers();
          });
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
  }

  editMember(id?: string) {
    this.selectedMemberId = id || null;
    this.showTeamMemberModal = true;
  }

  reset() {
    this.selectedMemberId = null;
  }

  async deleteTeamMember(id: string | undefined, email: string | undefined) {
    if (!id || !email) return;
    try {
      const res = await this.api.delete(id, email);
      if (res.done) {
        await this.getTeamMembers();
        if (this.auth.getCurrentSession()?.team_member_id === id) {
          window.location.reload();
        }
      }
    } catch (e) {
      log_error(e);
    }
  }

  selectValue(target: HTMLInputElement) {
    if (target) target.select();
  }

  async search() {
    void this.getTeamMembers();
  }

  selectMember(id?: string) {
    if (!id) return;
    // this.router.navigate([`/worklenz/team/member/${id}`]);
    this.editMember(id);
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
    this.sortOrder = (currentSort && currentSort.value) || "descend";

    await this.getTeamMembers();
  }

  openAddMemberForm() {
    this.showTeamMemberModal = true;
  }

  refresh() {
    void this.getTeamMembers();
  }

  handleOnCreateOrUpdate(event: number) {
    this.getTeamMembers();
  }

  async toggleMemberActiveStatus(member: ITeamMemberViewModel) {
    if (!member.id) return;
    try {
      const res = await this.api.toggleMemberActiveStatus(member.id, member.active as boolean, member.email as string);
      if (res.done) {
        await this.getTeamMembers();
      }
    } catch (e) {
      log_error(e);
    }
  }
}
