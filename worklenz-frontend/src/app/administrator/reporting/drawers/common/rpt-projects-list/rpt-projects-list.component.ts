import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output, ViewChild
} from '@angular/core';
import {IRPTOverviewProject, IRPTProject, IRPTProjectsViewModel} from "../../../interfaces";
import {ReportingApiService} from "../../../reporting-api.service";
import {log_error} from "@shared/utils";
import {ProjectHealthsApiService} from "@api/project-healths-api.service";
import {IProjectHealth} from "@interfaces/project-health";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {IProjectStatus} from "@interfaces/project-status";
import {ProjectStatusesApiService} from "@api/project-statuses-api.service";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {ProjectUpdatesDrawerComponent} from "@admin/components/project-updates-drawer/project-updates-drawer.component";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ProjectUpdatesService} from "@services/project-updates.service";
import {ReportingService} from "../../../reporting.service";

@Component({
  selector: 'worklenz-rpt-projects-list',
  templateUrl: './rpt-projects-list.component.html',
  styleUrls: ['./rpt-projects-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptProjectsListComponent implements OnInit, OnDestroy {
  @ViewChild(ProjectUpdatesDrawerComponent) updatesDrawer!: ProjectUpdatesDrawerComponent;

  @Input() teamId!: string;
  @Input() teamMemberId!: string;

  @Output() length = new EventEmitter<number>();
  @Output() selectProject = new EventEmitter<IRPTOverviewProject>();

  private readonly FILTER_INDEX_KEY = "worklenz.projects.filter_index";
  private readonly PROJECT_LIST_COLUMNS = "worklenz.reporting.projects.column_list";

  loading = false;
  projects: IRPTProject[] = [];
  projHealths: IProjectHealth[] = [];
  projectStatuses: IProjectStatus[] = []

  searchText!: string;

  total = 0;
  pageSize = 10;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;

  public COLUMN_KEYS = {
    CLIENT: "CLIENT",
    TEAM: "TEAM",
    STATUS: "STATUS",
    CATEGORY: "CATEGORY",
    START_END_DATE: "START_END_DATE",
    DAYS_LEFT_OVERDUE: "DAYS_LEFT_OVERDUE",
    ESTIMATED_VS_ACTUAL: "ESTIMATED_VS_ACTUAL",
    TASKS_PROGRESS: "TASKS_PROGRESS",
    LAST_ACTIVITY: "LAST_ACTIVITY",
    HEALTH: "HEALTH",
    UPDATE: "UPDATE",
    PROJECT_MANAGER: "PROJECT_MANAGER"
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
    {key: "PROJECT_MANAGER", label: "Project Manager", pinned: true},
    {key: "CLIENT", label: "Client", pinned: false},
    {key: "TEAM", label: "Team", pinned: false},
  ];

  clientActive = false;
  managerActive = false;
  teamActive = false;
  statusActive = true;
  categoryActive = true;
  startEndDateActive = true;
  daysLeftActive = true;
  estimatedActive = true;
  progressActive = true;
  lastActivityActive = true;
  healthActive = true;
  updateActive = true;

  get columnList() {
    if (localStorage.hasOwnProperty(this.PROJECT_LIST_COLUMNS))
      return JSON.parse(localStorage.getItem(this.PROJECT_LIST_COLUMNS) || '');
  }

  get filterIndex() {
    return +(localStorage.getItem(this.FILTER_INDEX_KEY) || 0);
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly projectHealthsApi: ProjectHealthsApiService,
    private readonly socket: Socket,
    private readonly statusesApi: ProjectStatusesApiService,
    private readonly service: ReportingService
  ) {}

  ngOnInit() {
    void this.getProjectHealths();
    void this.getProjectStatuses();
    void this.getProjects();
    this.socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), this.refreshWithoutLoading);
    this.socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), this.refreshWithoutLoading);
    if (this.columnList) {
      this.columns = this.columnList;
      this.updateState();
    }
  }

  ngOnDestroy() {
    this.projects = [];
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

  protected async getProjects(loading = true) {
    if (!this.teamId) return;
    try {
      this.loading = loading;
      const res = await this.api.getOverviewProjects(
        {
          team: this.teamId,
          index: this.pageIndex,
          size: this.pageSize,
          field: this.sortField,
          order: this.sortOrder,
          search: this.searchText || null,
          filter: this.filterIndex.toString(),
          archived: this.service.getIncludeToggle()
        }
      );
      if (res.done) {
        this.total = res.body.total || 0;
        this.projects = res.body.projects || [];
        this.length.emit(this.total);
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }
    this.cdr.markForCheck();
  }

  private async getProjectHealths() {
    try {
      const res = await this.projectHealthsApi.get();
      if (res) {
        this.projHealths = res.body
      }
    } catch (e) {
      log_error(e);
    }
    this.cdr.markForCheck();
  }

  async getProjectStatuses() {
    try {
      const res = await this.statusesApi.get();
      if (res.done) {
        this.projectStatuses = res.body;
      }
    } catch (e) {
      log_error(e);
    }
    this.cdr.markForCheck();
  }

  trackBy(index: number, data: IRPTOverviewProject) {
    return data.id;
  }

  openProject(project: IRPTOverviewProject) {
    if (project) {
      this.selectProject.emit(project);
    }
  }

  refreshWithoutLoading = () => {
    void this.getProjects(false);
  }

  openUpdates(data: IRPTProject) {
    this.updatesDrawer.open(data.id);
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
    this.managerActive = this.canActive(this.COLUMN_KEYS.PROJECT_MANAGER);
    this.cdr.markForCheck();
    this.setColumnList();
  }

  public canActive(key: string) {
    return !!this.columns.find(c => c.key === key)?.pinned;
  }

  setColumnList() {
    localStorage.setItem(this.PROJECT_LIST_COLUMNS, JSON.stringify(this.columns));
  }

}
