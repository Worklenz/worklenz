import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {AppService} from "@services/app.service";
import {IAllocationProject} from "@interfaces/allocation-view-model";
import {ISelectableTeam} from "@interfaces/selectable-team";
import {ISelectableProject} from "@interfaces/selectable-project";
import {ReportingApiService} from "../../../reporting-api.service";
import {log_error} from "@shared/utils";
import {ReportingExportApiService} from "@api/reporting-export-api.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ReportingService} from "../../../reporting.service";
import {merge} from "rxjs";
import {IProjectCategoryViewModel} from "@interfaces/project-category";
import moment from "moment/moment";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";

@Component({
  selector: 'worklenz-rpt-allocation',
  templateUrl: './rpt-allocation.component.html',
  styleUrls: ['./rpt-allocation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptAllocationComponent implements OnInit {
  loadingProjects = false;
  loadingCategories = false;
  loadingTeams = false;
  loading = false;
  selectAllTeams = true;
  selectAllProjects = true;
  selectAllCategories = true;
  selectNoCategory = true;
  isDurationLabelSelected = true;

  categorySearchText: string | null = null;
  teamSearchText: string | null = null;
  projectSearchText: string | null = null;

  projects: IAllocationProject[] = [];
  members: Array<{ name: string, total_time?: string }> = [];

  teamsDropDown: ISelectableTeam[] = [];
  projectsDropdown: ISelectableProject[] = [];
  categoriesDropdown: IProjectCategoryViewModel[] = [];
  selectAll = true;

  constructor(
    private readonly app: AppService,
    private readonly api: ReportingApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly exportApi: ReportingExportApiService,
    private service: ReportingService
  ) {
    this.app.setTitle("Reporting - Allocation");
    merge(
      this.service.onDurationChange,
      this.service.onDateRangeChange,
      this.service.onIncludeToggleChange
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.getAllocationData();
      });
  }

  ngOnInit() {
    void this.getTeams();
  }

  private getSelectedTeamIds(): string[] {
    const filter = this.teamsDropDown.filter(t => t.selected);
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

  selectAllCategoriesChecked(checked: boolean) {
    if (checked) {
      this.selectNoCategory = true;
      for (const item of this.categoriesDropdown) {
        item.selected = true;
      }
      this.refreshProjects();
      this.cdr.markForCheck();
    } else {
      this.selectNoCategory = false;
      for (const item of this.categoriesDropdown) {
        item.selected = false;
      }
      this.refreshProjects();
      this.cdr.markForCheck();
    }
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

  private async setDatesForKeys() {
    if(this.service.getDuration()?.key) {
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

  async getAllocationData() {
    try {
      this.loading = true;

      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }

      const teams = this.getSelectedTeamIds();
      const projects = this.getSelectedProjectIds();
      const duration = this.service.getDuration()?.key;

      const body = {
        teams,
        projects,
        duration,
        date_range: this.service.getDateRange(),
        archived: this.service.getIncludeToggle()
      };

      const res = await this.api.getAllocationData(body, this.service.getIncludeToggle());
      if (res.done) {
        this.members = res.body.users;
        this.projects = res.body.projects;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  async refreshCategories() {
    await this.getCategories(this.getSelectedTeamIds());
    void this.refreshProjects();
  }

  refreshProjects() {
    void this.getProjects(this.getSelectedTeamIds(), this.getSelectedCategories());
  }

  async getProjects(teams: string[], categories: string[]) {
    try {
      this.loadingProjects = true;
      const res = await this.api.getAllocationProjects(teams, categories, this.selectNoCategory);
      if (res.done) {
        this.projectsDropdown = res.body;
        void this.getAllocationData();
      }
      this.loadingProjects = false;
    } catch (e) {
      this.loadingProjects = false;
    }
    this.cdr.markForCheck();
  }

  private async getTeams() {
    try {
      this.loadingTeams = true;
      const res = await this.api.getOverviewTeams();
      if (res.done) {
        this.loadingTeams = false;
        const teams = [];
        for (const team of res.body) {
          teams.push({selected: true, name: team.name, id: team.id})
        }
        this.teamsDropDown = teams;
        void this.refreshCategories()
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
      this.loadingTeams = false;
    }
  }

  async export() {
    try {
      const teams = this.getSelectedTeamIds();
      const projects = this.getSelectedProjectIds();
      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }
      const duration = this.service.getDuration()?.key;
      const body = {
        teams,
        projects,
        duration,
        date_range: this.service.getDateRange(),
        archived: this.service.getIncludeToggle()
      };

      this.exportApi.exportAllocation(this.service.getIncludeToggle(), teams, projects, duration, this.service.getDateRange());
    } catch (e) {
      log_error(e);
    }
  }

  checkTeam() {
    this.selectAllTeams = false
    void this.refreshCategories();
  }

  checkCategory() {
    this.selectAllCategories = false
    void this.refreshProjects();
  }

  checkProject() {
    this.selectAllProjects = false
    this.getAllocationData();
  }

  selectAllTeamsChecked(checked: boolean) {
    if (checked) {
      for (const item of this.teamsDropDown) {
        item.selected = true;
      }
      this.refreshProjects();
      this.cdr.markForCheck();
    } else {
      for (const item of this.teamsDropDown) {
        item.selected = false;
      }
      this.refreshProjects();
      this.cdr.markForCheck();
    }
  }

  selectAllProjectsChecked(checked: boolean) {
    if (checked) {
      for (const item of this.projectsDropdown) {
        item.selected = true;
      }
      this.getAllocationData();
      this.cdr.markForCheck();
    } else {
      for (const item of this.projectsDropdown) {
        item.selected = false;
      }
      this.getAllocationData();
      this.cdr.markForCheck();
    }
  }

}
