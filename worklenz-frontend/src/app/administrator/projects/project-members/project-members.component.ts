import {ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener} from '@angular/core';
import {FormBuilder, FormGroup} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {ProjectMembersApiService} from "@api/project-members-api.service";
import {ProjectsApiService} from "@api/projects-api.service";
import {IProjectMembersViewModel} from "@interfaces/api-models/project-members-view-model";
import {IPaginationComponent} from "@interfaces/pagination-component";
import {AuthService} from "@services/auth.service";
import {UtilsService} from "@services/utils.service";
import {AvatarNamesMap, DEFAULT_PAGE_SIZE} from "@shared/constants";
import {EventProjectCreatedOrUpdated, EventTaskCreatedOrUpdate} from "@shared/events";
import {log_error} from "@shared/utils";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {ProjectFormService} from "@services/project-form-service.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ProjectsService} from "../projects.service";

@Component({
  selector: 'worklenz-project-members',
  templateUrl: './project-members.component.html',
  styleUrls: ['./project-members.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectMembersComponent implements IPaginationComponent {
  model: IProjectMembersViewModel = {};
  searchForm!: FormGroup;

  loading = true;
  showTaskDrawer = false;

  // Table sorting & pagination
  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;
  projectId: string | null = null;
  selectedTaskId: string | null = null;

  constructor(
    public auth: AuthService,
    private api: ProjectsApiService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private projectMembersApi: ProjectMembersApiService,
    private utilsService: UtilsService,
    private readonly projectFormService: ProjectFormService,
    private readonly cdr: ChangeDetectorRef,
    private readonly projectsService: ProjectsService
  ) {
    this.projectId = this.route.snapshot.paramMap.get("id");
    this.searchForm = this.fb.group({search: []});
    this.searchForm.valueChanges.subscribe(() => this.searchMembers());

    this.projectFormService.onMemberAssignOrRemoveReProject
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get();
      })
  }

  get title() {
    return `${this.total || 0} Members`;
  }

  @HostListener(`document:${EventTaskCreatedOrUpdate}`)
  @HostListener(`document:${EventProjectCreatedOrUpdated}`)
  async get() {
    if (!this.projectId) return;
    try {
      this.loading = true;
      const res = await this.api.getMembers(this.projectId, this.pageIndex, this.pageSize, this.sortField,
        this.sortOrder, this.searchForm.value.search || null);
      if (res.done) {
        this.model = res.body;
        this.total = this.model.total || 0;

        this.utilsService.handleLastIndex(this.total, this.model.data?.length || 0, this.pageIndex,
          index => {
            this.pageIndex = index;
            this.get();
          });
      }
      this.loading = false;
      this.cdr.detectChanges();
    } catch (e) {
      log_error(e);
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async searchMembers() {
    await this.get();
  }

  isOwnerOrAdmin() {
    return this.auth.getCurrentSession()?.owner || this.auth.getCurrentSession()?.is_admin;
  }

  isProjectManager() {
    if (this.projectsService.projectOwnerTeamMemberId) return this.auth.getCurrentSession()?.team_member_id === this.projectsService.projectOwnerTeamMemberId;
    return false;
  }

  async removeMember(id?: string) {
    if (!id) return;
    try {
      const res = await this.projectMembersApi.deleteById(id, this.projectId as string);
      if (res.done) {
        this.get();
      }
    } catch (e) {
      log_error(e);
    }
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

    await this.get();
  }

  selectMember(id?: string) {
    // if (!id) return;
    // this.router.navigate(['/worklenz/team/member/' + id]);
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.selectedTaskId = null;
    }
  }
}
