import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output} from '@angular/core';
import {ReportingService} from "../../reporting.service";
import {ReportingDrawersService} from "../reporting-drawers.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {
  IRPTDuration,
  IRPTMember,
  IRPTOverviewProject,
  IRPTSingleMemberDrawerData,
  IRPTTeam
} from "../../interfaces";
import {ReportingExportApiService} from "@api/reporting-export-api.service";
import {log_error} from "@shared/utils";
import {LogHeaderService} from "./rpt-single-member-drawer-overview/service/log-header.service";
import {AuthService} from "@services/auth.service";
import {ALL_TIME, LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";
import moment from "moment/moment";

@Component({
  selector: 'worklenz-rpt-single-member-drawer',
  templateUrl: './rpt-single-member-drawer.component.html',
  styleUrls: ['./rpt-single-member-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptSingleMemberDrawerComponent {
  @Output() selectProject = new EventEmitter<IRPTOverviewProject>();
  @Input() isDurationLabelSelected = true;

  member: IRPTMember | null = null;
  team: IRPTTeam | null = null;

  show = false;
  exporting = false;
  isDurationLabelSelected_ = false;

  readonly tabs = [
    {label: 'Overview', tab: 'overview'},
    {label: 'Time Logs', tab: 'time-logs'},
    {label: 'Activity Logs', tab: 'activity-logs'},
    {label: 'Tasks', tab: 'tasks'}
  ];

  selectedTab = 0;

  dateRange: string[] = [];

  durations: IRPTDuration[] = [
      {label: "Yesterday", key: YESTERDAY, dates: moment().subtract(1, "days").format('MMM,DD YYYY').toString()},
      {label: "Last 7 days", key: LAST_WEEK, dates: moment().subtract(1, "weeks").format('MMM,DD YYYY').toString() + " - " + moment().format('MMM,DD YYYY').toString()},
      {label: "Last week", key: PREV_WEEK, dates: moment().subtract(1, "weeks").startOf("week").format('MMM,DD YYYY').toString() + " - " + moment().subtract(1, "weeks").endOf("week").format('MMM,DD YYYY').toString()},
      {label: "Last 30 days", key: LAST_MONTH, dates: moment().subtract(1, "month").format('MMM,DD YYYY').toString() + " - " + moment().format('MMM,DD YYYY').toString()},
      {label: "Last month", key: PREV_MONTH, dates: moment().subtract(1, "month").startOf("month").format('MMM,DD YYYY').toString() + " - " + moment().subtract(1, "month").endOf("month").format('MMM,DD YYYY').toString()},
      {label: "Last 3 months", key: LAST_QUARTER, dates: moment().subtract(3, "months").format('MMM,DD YYYY').toString() + " - " + moment().format('MMM,DD YYYY').toString()},
      {label: "All time", key: ALL_TIME, dates: ''}
  ];

  get durationLabel() {
    const f = "yy-MM-DD";
    if (this.dateRange.length == 2)
      return `${moment(this.dateRange[0]).format(f)} - ${moment(this.dateRange[1]).format(f)}`;
    return this.selectedDuration ? this.selectedDuration.label : "Duration";
  }

  get selectedDuration() {
    return this.api.getDrawerDuration();
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ReportingService,
    private readonly drawer: ReportingDrawersService,
    private readonly exportApiService: ReportingExportApiService,
    private readonly headerService: LogHeaderService,
    private readonly auth: AuthService,
    private api: ReportingService
  ) {
    this.drawer.onOpenSingleMember
      .pipe(takeUntilDestroyed())
      .subscribe(data => {
        this.open(data);
      });
    this.drawer.onOpenSingleMemberTimeLogs.pipe(takeUntilDestroyed()).subscribe(() => {
      this.selectedTab = 1;
      this.cdr.markForCheck();
    })
  }


  private async open(data: IRPTSingleMemberDrawerData) {
    await this.setInitialValues();
    this.team = this.service.getCurrentTeam();
    this.member = data.member;
    this.show = true
    this.cdr.markForCheck();
  }

  closeDrawer() {
    this.show = false;
    this.member = null;
    this.team = null;
    this.selectedTab = 0;
    this.headerService.dateRange = [];
  }

  async exportTimeLogs() {
    if (!this.member || !this.auth.getCurrentSession()?.team_id) return;
    try {
      this.exporting = true;
      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }
      const body = {
        team_member_id: this.member.id,
        team_id: this.auth.getCurrentSession()?.team_id as string,
        duration: this.service.getDrawerDuration()?.key,
        date_range: this.service.getDrawerDateRange(),
        member_name: this.member.name,
        team_name: this.team?.name ? this.team.name : null,
        archived: this.service.getIncludeToggle()
      }
      this.exportApiService.exportMemberTimeLogs(body);
      this.exporting = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.exporting = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async exportActivityLogs() {
    if (!this.member || !this.auth.getCurrentSession()?.team_id) return;
    try {
      this.exporting = true;
      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }
      const body = {
        team_member_id: this.member.id,
        team_id: this.auth.getCurrentSession()?.team_id as string,
        duration: this.service.getDrawerDuration()?.key,
        date_range: this.service.getDrawerDateRange(),
        member_name: this.member.name,
        team_name: this.team?.name ? this.team.name : null,
        archived: this.service.getIncludeToggle()
      }
      this.exportApiService.exportMemberActivityLogs(body);
      this.exporting = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.exporting = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async exportTasks() {
    if (!this.member) return;
    try {
      this.exporting = true;
      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }
      const body = {
        duration: this.service.getDrawerDuration()?.key,
        date_range: this.service.getDrawerDateRange(),
        only_single_member: true,
        archived: this.service.getIncludeToggle()
      }
      this.exportApiService.exportMemberTasks(this.member.id, this.member.name, this.team?.name, body);
      this.exporting = false;
    } catch (e) {
      this.exporting = false;
      log_error(e);
    }
  }

  setInitialValues() {

    const globalDateRange = this.api.getDrawerDateRange();
    if (globalDateRange.length === 2 && !this.isDurationLabelSelected) {
      this.dateRange = globalDateRange
    }

    if (!this.api.getDrawerDuration())
      return this.api.setDrawerDuration(this.durations.find(d => d.key === LAST_WEEK) || null);

    this.api.setDrawerDuration(this.api.getDrawerDuration());

  }

  selectedTabChange(index: number) {
    this.selectedTab = index;

    switch (this.selectedTab) {
      case 0:
        this.drawer.emitGetSingleMemberOverview();
        break;
      case 1:
        this.drawer.emitGetSingleMemberTimeLogs();
        break;
      case 2:
        this.drawer.emitGetSingleMemberActivityLogs();
        break;
      case 3:
        this.drawer.emitGetSingleMemberProjects();
        break;
      case 4:
        this.drawer.emitGetSingleMemberTasks();
        break;
    }
  }

  onDurationChange(item: IRPTDuration) {
    this.isDurationLabelSelected = true;
    setTimeout( () => {
      this.api.setDrawerDuration(item);
      this.dateRange = [];
      this.api.setDrawerDateRange(this.dateRange);
      this.api.emitDrawerDurationChanged();
    }, 500);
  }

  customDateChange() {
    this.isDurationLabelSelected = false;
    setTimeout( () => {
      this.api.setDrawerDateRange(this.dateRange);
      this.api.emitDrawerDateRangeChanged();
    }, 500);
  }

    private async setDatesForKeys() {
    if(this.service.getDrawerDuration()?.key) {
      const key = this.service.getDrawerDuration()?.key;
      const today = moment();

      switch (key) {
        case YESTERDAY:
          const yesterday = moment().subtract(1, "days");
          this.service.setDrawerDateRange([yesterday.toString(), yesterday.toString()]);
          break;
        case LAST_WEEK:
          const lastWeekStart = moment().subtract(1, "weeks");
          this.service.setDrawerDateRange([lastWeekStart.toString(), today.toString()]);
          break;
        case LAST_MONTH:
          const lastMonthStart = moment().subtract(1, "months");
          this.service.setDrawerDateRange([lastMonthStart.toString(), today.toString()]);
          break;
        case LAST_QUARTER:
          const lastQuaterStart = moment().subtract(3, "months");
          this.service.setDrawerDateRange([lastQuaterStart.toString(), today.toString()]);
          break;
        case PREV_WEEK:
          const prevWeekStart = moment().subtract(1, "weeks").startOf("week");
          const prevWeekEnd = moment().subtract(1, "weeks").endOf("week");
          this.service.setDrawerDateRange([prevWeekStart.toString(), prevWeekEnd.toString()]);
          break;
        case PREV_MONTH:
          const prevMonthStart = moment().subtract(1, "month").startOf("month");
          const prevMonthEnd = moment().subtract(1, "month").endOf("month");
          this.service.setDrawerDateRange([prevMonthStart.toString(), prevMonthEnd.toString()]);
          break;
      }
    }
  }

}
