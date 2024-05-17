import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup,} from '@angular/forms';

import {AppService} from '@services/app.service';
import {ProjectsApiService} from '@api/projects-api.service';
import {IProjectsViewModel} from "@interfaces/api-models/projects-view-model";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {AuthService} from "@services/auth.service";
import {ActivatedRoute, Router} from "@angular/router";
import {DEFAULT_PAGE_SIZE} from "@shared/constants";
import {IProject} from "@interfaces/project";
import {ProjectFormModalComponent} from "../../components/project-form-modal/project-form-modal.component";
import {UtilsService} from "@services/utils.service";
import {log_error} from "@shared/utils";
import {IProjectViewModel} from "@interfaces/api-models/project-view-model";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {NzSegmentedOption} from "ng-zorro-antd/segmented";
import {ProjectsFolderFormDrawerComponent} from "./projects-folder-form-drawer/projects-folder-form-drawer.component";
import {ProjectCategoriesApiService} from "@api/project-categories-api.service";
import {IProjectCategoryViewModel} from "@interfaces/project-category";
import {TaskListV2Service} from "../../modules/task-list-v2/task-list-v2.service";
import {
  ProjectTemplateImportDrawerComponent
} from "@admin/components/project-template-import-drawer/project-template-import-drawer.component";
import {ProjectTemplateApiService} from "@api/project-template-api.service";
import {IProjectStatus} from "@interfaces/project-status";
import {ProjectStatusesApiService} from "@api/project-statuses-api.service";

@Component({
  selector: 'worklenz-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsComponent implements OnInit {
  @ViewChild(ProjectFormModalComponent) projectsForm!: ProjectFormModalComponent;
  @ViewChild(ProjectsFolderFormDrawerComponent) folderForm!: ProjectsFolderFormDrawerComponent;
  @ViewChild('displayModeTemplate', {static: true, read: TemplateRef}) displayModeSegments!: TemplateRef<{
    $implicit: NzSegmentedOption;
    index: number;
  }>;
  @ViewChild(ProjectTemplateImportDrawerComponent) projectTemplateDrawer!: ProjectTemplateImportDrawerComponent;

  private readonly FILTER_INDEX_KEY = "worklenz.projects.filter_index";
  private readonly DISPLAY_MODE_KEY = "worklenz.projects.display_as";

  searchForm!: FormGroup;

  projectsModel: IProjectsViewModel = {};
  categories: IProjectCategoryViewModel[] = [];
  statuses: IProjectStatus[] = [];

  expandSet = new Set<string>();

  // Table sorting & pagination
  total = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;
  categoriesFilterString: string | null = null;
  statusesFilterString: string | null = null;

  loading = true;
  loadingCategories = false;
  loadingStatuses = false;
  showCategoriesFilter = false;
  showStatusesFilter = false;
  filteredByCategory = false;
  filteredByStatus = false;

  readonly filters = [
    'All',
    'Favorites',
    'Archived',
  ];

  get filterIndex() {
    return +(localStorage.getItem(this.FILTER_INDEX_KEY) || 0);
  }

  set filterIndex(index: number) {
    localStorage.setItem(this.FILTER_INDEX_KEY, index.toString());
  }

  constructor(
    private readonly app: AppService,
    private readonly api: ProjectsApiService,
    private readonly fb: FormBuilder,
    public readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly utilsService: UtilsService,
    private readonly categoriesApi: ProjectCategoriesApiService,
    private readonly templatesApi: ProjectTemplateApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly list: TaskListV2Service,
    private readonly statusesApi: ProjectStatusesApiService
  ) {
    this.app.setTitle('Projects');

    this.pageSize = +(this.route.snapshot.queryParamMap.get("size") || DEFAULT_PAGE_SIZE);
    this.pageIndex = +(this.route.snapshot.queryParamMap.get("index") || 1);
  }

  async ngOnInit() {
    this.searchForm = this.fb.group({
      search: [],
    });

    this.searchForm.valueChanges.subscribe(() => {
      this.searchProjects();
    });

    void this.getCategories();
    void this.getStatuses();
  }

  private getFilterIndexText() {
    return this.filters[this.filterIndex];
  }

  refresh() {
    void this.getCategories();
    void this.getProjects();
  }

  async import() {
    await this.templatesApi.createTemplates();
  }

  async getCategories() {
    try {
      this.loadingCategories = true;
      const res = await this.categoriesApi.get();
      if (res.done) {
        this.categories = res.body;
      }

      this.loadingCategories = false;
    } catch (e) {
      this.loadingCategories = false;
    }

    this.cdr.markForCheck();
  }

  async getStatuses() {
    try {
      this.loadingStatuses = true;
      const res = await this.statusesApi.get();
      if (res.done) {
        this.statuses = res.body;
      }

      this.loadingStatuses = false;
    } catch (e) {
      this.loadingStatuses = false;
    }

    this.cdr.markForCheck();
  }

  async getProjects(ignoreLoading = false) {
    try {
      if (!ignoreLoading)
        this.loading = true;
      const res = await this.api.getByConfig({
        index: this.pageIndex,
        size: this.pageSize,
        field: this.sortField,
        order: this.sortOrder,
        search: this.searchForm.value.search,
        filter: this.filterIndex.toString(),
        categories: this.categoriesFilterString,
        statuses: this.statusesFilterString
      });
      if (res.done) {
        this.handleProjectsResponse(res);
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.markForCheck();
  }

  private handleProjectsResponse(res: IServerResponse<IProjectsViewModel>) {
    this.projectsModel = res.body;
    this.total = this.projectsModel.total || 0;

    this.utilsService.handleLastIndex(this.total, this.projectsModel.data?.length || 0, this.pageIndex,
      index => {
        this.pageIndex = index;
        this.getProjects();
      });
  }

  async searchProjects() {
    await this.getProjects();
  }

  isOwnerOrAdmin() {
    return this.auth.isOwnerOrAdmin();
  }

  openProjectForm(id?: string) {
    this.projectsForm?.open(id, !!id);
  }

  selectProject(id: string | undefined, view: string) {
    if (!id) return;
    let viewTab = 'tasks-list';
    switch (view) {
      case 'TASK_LIST':
        viewTab = 'tasks-list';
        break;
      case 'BOARD':
        viewTab = 'board';
        break;
      default :
        viewTab = 'tasks-list';
    }
    void this.router.navigate(
      [`/worklenz/projects/${id}`],
      {
        queryParams: {tab: `${viewTab}`, pinned_tab: `${viewTab}` }
      });

  }

  getTaskProgressTitle(data: IProjectViewModel) {
    if (!data.all_tasks_count)
      return 'No tasks available.';
    if (data.all_tasks_count == data.completed_tasks_count)
      return 'All tasks completed.';
    return `${data.completed_tasks_count || 0}/${data.all_tasks_count || 0} tasks completed.`;
  }

  async toggleFavorite(id?: string) {
    if (!id) return;
    try {
      const res = await this.api.toggleFavorite(id);
      if (this.filterIndex == 1 && res.done) {
        void this.getProjects(true);
      }
    } catch (e) {
      log_error(e);
    }
  }

  async toggleArchive(project?: IProjectViewModel) {
    if (!project || !project.id) return;
    if (project.loading) return;
    try {
      project.loading = true;

      if (this.isOwnerOrAdmin()) {
        const res = await this.api.toggleArchiveAll(project.id);
        if (res.done) {
          await this.getProjects(true);
        }
      } else {
        const res = await this.api.toggleArchive(project.id);
        if (res.done) {
          await this.getProjects(true);
        }
      }

      project.loading = false;
    } catch (e) {
      project.loading = false;
      log_error(e);
    }
  }

  onFilterChange(index: number) {
    if (this.loading) return;
    this.filterIndex = index;
    this.getProjects();
  }

  trackBy(index: number, item: IProjectViewModel) {
    return item.id;
  }

  onProjectCreate(project: IProject | null) {
    if (!project?.id) return;
    this.list.setCurrentGroup(this.list.GROUP_BY_OPTIONS[0]);
    this.selectProject(project.id, "TASK_LIST");
  }

  onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    const currentSort = sort.find(item => item.value !== null);

    this.sortField = currentSort?.key ?? null;
    this.sortOrder = currentSort?.value ?? null;

    void this.getProjects();
  }

  filterByCategory(categoryId: string | undefined) {
    if (!categoryId) return;
    const category = this.categories.find(c => c.id === categoryId);
    if (category) {
      category.selected = true;
      this.onCategoryFilterChange();
    }
  }

  filterByStatus(statusId: string | undefined) {
    if (!statusId) return;
    const status = this.statuses.find(c => c.id === statusId);
    if (status) {
      status.selected = true;
      this.onStatusFilterChange();
    }
  }

  onCategoryFilterChange() {
    const categories = this.categories.filter(c => c.selected);
    this.filteredByCategory = !!categories.length;
    const filterString = categories.map(c => c.id).join("+");
    this.categoriesFilterString = filterString || null;
    void this.getProjects();
  }

  onStatusFilterChange() {
    const statuses = this.statuses.filter(c => c.selected);
    this.filteredByStatus = !!statuses.length;
    const filterString = statuses.map(s => s.id).join("+");
    this.statusesFilterString = filterString || null;
    void this.getProjects();
  }

  onProjectUpdated() {
    void this.getProjects();
    void this.getCategories();
  }

  openTemplateSelector() {
    this.projectTemplateDrawer.open();
    this.cdr.markForCheck();
  }

}
