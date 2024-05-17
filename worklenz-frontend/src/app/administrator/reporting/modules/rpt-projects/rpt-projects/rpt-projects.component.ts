import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AppService} from "@services/app.service";
import {ReportingApiService} from "../../../reporting-api.service";
import {IRPTProject} from "../../../interfaces";
import {ReportingDrawersService} from "../../../drawers/reporting-drawers.service";
import {log_error} from "@shared/utils";
import {IProjectHealth} from "@interfaces/project-health";
import {ProjectHealthsApiService} from "@api/project-healths-api.service";
import {ReportingExportApiService} from "@api/reporting-export-api.service";
import {AuthService} from "@services/auth.service";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {IProjectStatus} from "@interfaces/project-status";
import {ProjectStatusesApiService} from "@api/project-statuses-api.service";
import {ProjectUpdatesDrawerComponent} from "@admin/components/project-updates-drawer/project-updates-drawer.component";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ProjectUpdatesService} from "@services/project-updates.service";
import {IProjectCategoryViewModel} from "@interfaces/project-category";
import {ProjectCategoriesApiService} from "@api/project-categories-api.service";
import {merge} from "rxjs";
import {ReportingService} from "../../../reporting.service";
import {AvatarNamesMap} from "@shared/constants";
import {ProjectManagersApiService} from "@api/project-managers-api.service";
import {IProjectManager} from "@interfaces/project-manager";

@Component({
  selector: 'worklenz-rpt-projects',
  templateUrl: './rpt-projects.component.html',
  styleUrls: ['./rpt-projects.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptProjectsComponent implements OnInit, OnDestroy {
  @ViewChild(ProjectUpdatesDrawerComponent) updatesDrawer!: ProjectUpdatesDrawerComponent;

  private readonly FILTER_INDEX_KEY = "worklenz.projects.filter_index";
  private readonly PROJECT_LIST_COLUMNS = "worklenz.reporting.projects.column_list";

  loading = false;
  loadingStatuses = false;
  loadingHealths = false;
  loadingCategories = false;
  loadingProjectManagers = false;

  projects: IRPTProject[] = [];
  projHealths: IProjectHealth[] = [];
  projectStatuses: IProjectStatus[] = [];
  projCategories: IProjectCategoryViewModel[] = [];
  projectManagers: IProjectManager[] = [];
  searchText!: string;

  // pagination
  total:number | null = null;
  pageSize = 10;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;
  categorySearchText: string | null = null;
  projectManagerSearchText: string | null = null;
  pageTitle: string = "Projects"

  public COLUMN_KEYS = {
    CLIENT: "CLIENT",
    ESTIMATED_VS_ACTUAL: "ESTIMATED_VS_ACTUAL",
    TASKS_PROGRESS: "TASKS_PROGRESS",
    LAST_ACTIVITY: "LAST_ACTIVITY",
    STATUS: "STATUS",
    START_END_DATE: "START_END_DATE",
    DAYS_LEFT_OVERDUE: "DAYS_LEFT_OVERDUE",
    CATEGORY: "CATEGORY",
    HEALTH: "HEALTH",
    UPDATE: "UPDATE",
    TEAM: "TEAM",
  };

  public columns: { key: string; label: string; pinned: boolean }[] = [
    {key: "ESTIMATED_VS_ACTUAL", label: "Estimated vs Actual", pinned: true},
    {key: "TASKS_PROGRESS", label: "Tasks Progress", pinned: true},
    {key: "LAST_ACTIVITY", label: "Last Activity", pinned: true},
    {key: "STATUS", label: "Status", pinned: true},
    {key: "START_END_DATE", label: "Start/End dates", pinned: true},
    {key: "DAYS_LEFT_OVERDUE", label: "Days Left/Overdue", pinned: true},
    {key: "HEALTH", label: "Project Health", pinned: true},
    {key: "CATEGORY", label: "Category", pinned: true},
    {key: "UPDATE", label: "Project Update", pinned: true},
    {key: "CLIENT", label: "Client", pinned: true},
    {key: "TEAM", label: "Team", pinned: true},
  ];

  statusActive = true;
  categoryActive = true;
  startEndDateActive = true;
  daysLeftActive = true;
  estimatedActive = true;
  progressActive = true;
  lastActivityActive = true;
  healthActive = true;
  updateActive = true;
  clientActive = false;
  teamActive = false;
  projectManagerActive = true;

  get filterIndex() {
    return +(localStorage.getItem(this.FILTER_INDEX_KEY) || 0);
  }

  get columnList() {
    if (localStorage.hasOwnProperty(this.PROJECT_LIST_COLUMNS))
      return JSON.parse(localStorage.getItem(this.PROJECT_LIST_COLUMNS) || '');
  }

  private getSelectedStatusIds(): string[] {
    const filter = this.projectStatuses.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];
  }

  private getSelectedHealthIds(): string[] {
    const filter = this.projHealths.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];
  }

  private getSelectedCategoryIds(): string[] {
    const filter = this.projCategories.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];

  }

  private getSelectedProjectManager(): string[] {
    const filter = this.projectManagers.filter(pm => pm.selected);
    const ids = filter.map(pm => pm.id) as string[];
    return ids || [];
  }

  constructor(
    private readonly app: AppService,
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly drawer: ReportingDrawersService,
    private readonly projectHealthsApi: ProjectHealthsApiService,
    private readonly exportApi: ReportingExportApiService,
    private readonly auth: AuthService,
    private readonly socket: Socket,
    private readonly statusesApi: ProjectStatusesApiService,
    private readonly projectUpdatesService: ProjectUpdatesService,
    private readonly categoriesApi: ProjectCategoriesApiService,
    private readonly projectManagersApi: ProjectManagersApiService,
    private readonly service: ReportingService
  ) {
    this.app.setTitle("Reporting - Projects");

    this.projectUpdatesService.onGetLatestUpdate
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.get(false);
      });

    merge(
      this.service.onDurationChange,
      this.service.onDateRangeChange,
      this.service.onIncludeToggleChange
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get();
      });

    this.socket.on(SocketEvents.CREATE_PROJECT_CATEGORY.toString(), this.newCategoryReceived);
  }

  ngOnInit() {
    void this.getProjectHealths();
    void this.getProjectStatuses();
    void this.getProjectCategories();
    void this.getProjectManagers();
    this.socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), this.refreshWithoutLoading);
    this.socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), this.refreshWithoutLoading);

    if (this.columnList) {
      this.columns = this.columnList;
      this.updateState();
    }
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), this.refreshWithoutLoading);
    this.socket.removeListener(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), this.refreshWithoutLoading);
  }

  searchProjects() {
    this.get(false);
  }

  onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    const currentSort = sort.find(item => item.value !== null);

    this.sortField = currentSort?.key ?? null;
    this.sortOrder = currentSort?.value ?? null;
    void this.get();
  }

  public async get(loading = true) {
    try {
      this.loading = loading;
      const statuses = this.getSelectedStatusIds();
      const healths = this.getSelectedHealthIds();
      const categories = this.getSelectedCategoryIds();
      const projectManagers = this.getSelectedProjectManager();

      const res = await this.api.getProjects({
        index: this.pageIndex,
        size: this.pageSize,
        field: this.sortField,
        order: this.sortOrder,
        search: this.searchText || null,
        filter: this.filterIndex.toString(),
        statuses: statuses,
        healths: healths,
        categories: categories,
        project_managers: projectManagers,
        archived: this.service.getIncludeToggle()
      });
      if (res.done) {
        this.total = res.body.total || 0;
        this.projects = res.body.projects || [];
        this.pageTitle = this.total + " Projects"
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }
    this.cdr.markForCheck();
  }

  private async getProjectManagers() {
    try {
      this.loadingProjectManagers = true;

      const res = await this.projectManagersApi.get();

      if (res.body) {
        this.projectManagers = res.body;
      }

      this.loadingProjectManagers = false;
    } catch (e) {
      log_error(e);
      this.loadingProjectManagers = false;
    }
    this.cdr.markForCheck();
  }

  private async getProjectHealths() {
    try {
      this.loadingHealths = true;
      const res = await this.projectHealthsApi.get();
      if (res) {
        for (const health of res.body) {
          health.selected = false;
        }
        this.projHealths = res.body;
      }
      this.loadingHealths = false;
    } catch (e) {
      log_error(e);
      this.loadingHealths = false;
    }
    this.cdr.markForCheck();
  }

  async getProjectStatuses() {
    try {
      this.loadingStatuses = true;
      const res = await this.statusesApi.get();
      if (res.done) {
        for (const status of res.body) {
          status.selected = false;
        }
        this.projectStatuses = res.body;
      }
      this.loadingStatuses = false;
    } catch (e) {
      log_error(e);
      this.loadingStatuses = false;
    }
    this.cdr.markForCheck();
  }

  async getProjectCategories() {
    try {
      this.loadingCategories = true;
      const res = await this.categoriesApi.getByOrg();
      if (res) {
        for (const category of res.body) {
          category.selected = false;
        }
        this.projCategories = res.body;
      }
      this.loadingCategories = false;
    } catch (e) {
      log_error(e);
      this.loadingCategories = false;
    }
    this.cdr.markForCheck();
  }

  private newCategoryReceived = (response: {
    id: string;
    category_id: string;
    category_name: string;
    category_color: string
  }) => {
    if (response) {
      const body = {
        id: response.category_id,
        name: response.category_name,
        color_code: response.category_color,
        selected: false,
      }

      this.projCategories.push(body);
      this.cdr.markForCheck();
    }
  }

  trackBy(index: number, item: IRPTProject) {
    return item.id;
  }

  openProject(data: IRPTProject) {
    this.drawer.openProject(data);
  }

  async export() {
    const session = this.auth.getCurrentSession();
    if (!session?.name) return;
    try {
      const res = await this.exportApi.exportProjects(session.team_name);
    } catch (e) {
      log_error(e);
    }
  }

  refreshWithoutLoading = () => {
    void this.get(false);
  }

  openUpdates(data: IRPTProject) {
    this.updatesDrawer.open(data.id);
  }

  protected async onColumnsToggle(checked: boolean, item: any) {
    try {
      item.pinned = checked;
      this.updateState();
    } catch (e) {
      // ignored
    }
  }

  private updateState() {
    this.clientActive = this.canActive(this.COLUMN_KEYS.CLIENT);
    this.teamActive = this.canActive(this.COLUMN_KEYS.TEAM);
    this.categoryActive = this.canActive(this.COLUMN_KEYS.CATEGORY);
    this.statusActive = this.canActive(this.COLUMN_KEYS.STATUS);
    this.startEndDateActive = this.canActive(this.COLUMN_KEYS.START_END_DATE);
    this.daysLeftActive = this.canActive(this.COLUMN_KEYS.DAYS_LEFT_OVERDUE);
    this.estimatedActive = this.canActive(this.COLUMN_KEYS.ESTIMATED_VS_ACTUAL);
    this.progressActive = this.canActive(this.COLUMN_KEYS.TASKS_PROGRESS);
    this.lastActivityActive = this.canActive(this.COLUMN_KEYS.LAST_ACTIVITY);
    this.healthActive = this.canActive(this.COLUMN_KEYS.HEALTH);
    this.updateActive = this.canActive(this.COLUMN_KEYS.UPDATE);
    this.cdr.markForCheck();
    this.setColumnList();
  }

  public canActive(key: string) {
    return !!this.columns.find(c => c.key === key)?.pinned;
  }

  setColumnList() {
    localStorage.setItem(this.PROJECT_LIST_COLUMNS, JSON.stringify(this.columns));
  }

  detectChanges() {
    this.cdr.markForCheck();
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

}
