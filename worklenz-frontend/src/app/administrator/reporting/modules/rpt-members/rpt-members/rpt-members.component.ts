import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {AppService} from "@services/app.service";
import {IRPTMember, IRPTMemberResponse} from "../../../interfaces";
import {ReportingApiService} from "../../../reporting-api.service";
import {ReportingDrawersService} from "../../../drawers/reporting-drawers.service";
import {log_error} from "@shared/utils";
import {AuthService} from "@services/auth.service";
import {ReportingExportApiService} from "@api/reporting-export-api.service";
import {NzTableQueryParams} from "ng-zorro-antd/table";
import {IProjectCategoryViewModel} from "@interfaces/project-category";
import {ReportingService} from "../../../reporting.service";
import {ISelectableProject} from "@interfaces/selectable-project";
import {merge} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";
import moment from "moment";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";
import {TaskViewService} from "@admin/components/task-view/task-view.service";


@Component({
  selector: 'worklenz-rpt-members',
  templateUrl: './rpt-members.component.html',
  styleUrls: ['./rpt-members.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptMembersComponent implements OnInit, OnDestroy {
  private readonly FILTER_INDEX_KEY = "worklenz.projects.filter_index";

  loading = false;
  loadingProjects = false;
  loadingTeams = false;
  loadingCategories = false;
  filteredByTeam = false;
  selectAllTeams = true;
  selectAllProjects = true;
  selectNoCategory = true;
  isDurationLabelSelected = true;


  teamsFilterString: string | null = null;
  teamSearchText: string | null = null;
  projectSearchText: string | null = null;
  categorySearchText: string | null = null;

  result: IRPTMemberResponse | null = null;
  members: IRPTMember[] = [];
  teams: IProjectCategoryViewModel[] = [];
  projectsDropdown: ISelectableProject[] = [];
  categoriesDropdown: IProjectCategoryViewModel[] = [];

  searchText!: string;

  // pagination
  total = 0;
  pageSize = 10;
  pageIndex = 1;
  paginationSizes = [5, 10, 15, 20, 50, 100];
  sortField: string | null = null;
  sortOrder: string | null = null;

  initial = true;

  constructor(
    private readonly app: AppService,
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly drawer: ReportingDrawersService,
    private readonly auth: AuthService,
    private readonly exportApi: ReportingExportApiService,
    private readonly service: ReportingService,
    private readonly socket: Socket,
    private readonly taskView: TaskViewService
  ) {
    this.app.setTitle("Reporting - Members");

    merge(
      this.service.onDurationChange,
      this.service.onDateRangeChange,
      this.service.onIncludeToggleChange
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get(true);
      });

    merge(
      this.taskView.onRefresh
    ).pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get(true);
      });

  }

  async ngOnInit() {
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refreshList);
    this.socket.on(SocketEvents.TASK_TIMER_STOP.toString(), this.refreshList);
    // await this.get(true);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), this.refreshList);
    this.socket.removeListener(SocketEvents.TASK_TIMER_STOP.toString(), this.refreshList);
  }

  refreshList = async () => {
    await this.get(false);
  }

  onQueryParamsChange(params: NzTableQueryParams) {
    const {pageSize, pageIndex, sort} = params;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    const currentSort = sort.find(item => item.value !== null);

    this.sortField = currentSort?.key ?? null;
    this.sortOrder = currentSort?.value ?? null;
    void this.get(true);
  }

  private async setDatesForKeys() {
    if (this.service.getDuration()?.key) {
      const key = this.service.getDuration()?.key;
      const today = moment();

      switch (key) {
        case YESTERDAY:
          const yesterday = moment().subtract(1, "days");
          this.service.setDateRange([yesterday.toString(), yesterday.toString()]);
          break;
        case LAST_WEEK:
          const lastWeekStart = moment().subtract(1, "weeks");
          this.service.setDateRange([lastWeekStart.toString(), today.toString()]);
          break;
        case LAST_MONTH:
          const lastMonthStart = moment().subtract(1, "months");
          this.service.setDateRange([lastMonthStart.toString(), today.toString()]);
          break;
        case LAST_QUARTER:
          const lastQuaterStart = moment().subtract(3, "months");
          this.service.setDateRange([lastQuaterStart.toString(), today.toString()]);
          break;
        case PREV_WEEK:
          const prevWeekStart = moment().subtract(1, "weeks").startOf("week");
          const prevWeekEnd = moment().subtract(1, "weeks").endOf("week");
          this.service.setDateRange([prevWeekStart.toString(), prevWeekEnd.toString()]);
          break;
        case PREV_MONTH:
          const prevMonthStart = moment().subtract(1, "month").startOf("month");
          const prevMonthEnd = moment().subtract(1, "month").endOf("month");
          this.service.setDateRange([prevMonthStart.toString(), prevMonthEnd.toString()]);
          break;
      }
    }
  }

  private async get(loading = true) {
    try {
      this.loading = loading;
      const projects = this.getSelectedProjectIds();

      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }

      const res = await this.api.getMembers({
        index: this.pageIndex,
        size: this.pageSize,
        field: this.sortField,
        order: this.sortOrder,
        search: this.searchText || null,
        filter: this.filterIndex.toString(),
        teams: this.teamsFilterString,
        duration: this.service.getDuration()?.key,
        date_range: this.service.getDateRange(),
        archived: this.service.getIncludeToggle(),
        projects
      });
      if (res.done) {
        this.result = res.body || null;
        this.total = res.body.total || 0;
        this.members = res.body.members;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  async getTeams() {
    try {
      this.loadingTeams = true;
      const res = await this.api.getOverviewTeams();
      if (res.done) {
        for (const team of res.body) {
          team.selected = true;
        }
        this.teams = res.body;
        await this.refreshCategories();
      }
      this.loadingTeams = false;
    } catch (e) {
      this.loadingTeams = false;
    }
    this.cdr.markForCheck();
  }

  get filterIndex() {
    return +(localStorage.getItem(this.FILTER_INDEX_KEY) || 0);
  }

  trackBy(index: number, item: IRPTMember) {
    return item.id;
  }

  openMember(data: IRPTMember) {
    if(this.result?.team) {
      this.service.setCurrentTeam({
        id: this.result?.team.id as string,
        name: this.result?.team.name as string,
        projects_count: 0,
        members: [],
        selected: false
      })
    }
    this.drawer.openSingleMember(data);
  }

  async export() {
    const session = this.auth.getCurrentSession();
    if (!session?.name) return;
    if (this.isDurationLabelSelected) {
      await this.setDatesForKeys();
    }
    try {
      this.exportApi.exportMembers(
        session.team_name,
        this.service.getDuration()?.key,
        this.service.getDateRange(),
        this.service.getIncludeToggle()
      );
    } catch (e) {
      log_error(e);
    }
  }

  searchProjects() {
    void this.get(false);
  }

  applyTeamsFilter() {
    const selectedTeams = this.teams.filter(c => c.selected);
    this.filteredByTeam = !!selectedTeams.length;
    const filterString = selectedTeams.map(c => c.id).join("+");
    this.teamsFilterString = filterString || null;
    void this.get();
  }

  async getProjects(teams: string[], categories: string[]) {
    try {
      this.loadingProjects = true;
      const res = await this.api.getAllocationProjects(teams, categories, this.selectNoCategory);
      if (res.done) {
        this.projectsDropdown = res.body;
      }
      this.loadingProjects = false;
    } catch (e) {
      this.loadingProjects = false;
    }
    this.cdr.markForCheck();
  }

  async getCategories(teams: string[]) {
    try {
      this.loadingCategories = true;
      const res = await this.api.getCategories(teams);
      if (res.done) {
        this.categoriesDropdown = res.body;
      }
      this.loadingCategories = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingCategories = false;
      this.cdr.markForCheck();
    }
  }

  async refreshCategories() {
    await this.getCategories(this.getSelectedTeamIds());
    void this.refreshProjects();
  }

  async refreshProjects() {
    await this.getProjects(this.getSelectedTeamIds(), this.getSelectedCategories());
    void this.get();
  }

  private getSelectedTeamIds(): string[] {
    const filter = this.teams.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];
  }

  private getSelectedCategories(): string[] {
    const filter = this.categoriesDropdown.filter(c => c.selected);
    const ids = filter.map(c => c.id) as string[];
    return ids || [];
  }

  private getSelectedProjectIds(): string[] {
    const filter = this.projectsDropdown.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];
  }

  detectChanges() {
    this.cdr.markForCheck();
  }

  projectsChanged() {
    void this.get();
  }

  checkTeam() {
    this.selectAllTeams = false
    this.applyTeamsFilter();
    this.refreshProjects();
  }

  checkProject() {
    this.selectAllProjects = false
    this.projectsChanged();
  }

  selectAllTeamsChecked(checked: boolean) {
    if (checked) {
      for (const item of this.teams) {
        item.selected = true;
      }
      this.refreshProjects();
      this.applyTeamsFilter();
      this.cdr.markForCheck();
    } else {
      for (const item of this.teams) {
        item.selected = false;
      }
      this.refreshProjects();
      this.applyTeamsFilter();
      this.cdr.markForCheck();
    }
  }

  selectAllProjectsChecked(checked: boolean) {
    if (checked) {
      for (const item of this.projectsDropdown) {
        item.selected = true;
      }
      this.projectsChanged();
      this.cdr.markForCheck();
    } else {
      for (const item of this.projectsDropdown) {
        item.selected = false;
      }
      this.projectsChanged();
      this.cdr.markForCheck();
    }
  }

}
