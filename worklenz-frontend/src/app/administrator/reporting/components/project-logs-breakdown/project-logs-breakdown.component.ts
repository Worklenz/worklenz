import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output} from '@angular/core';
import {log_error} from "@shared/utils";
import {ReportingApiService} from "../../reporting-api.service";
import {IProjectLogsBreakdown, IRPTDuration, IRPTTimeProject, ITimeLogBreakdownReq} from "../../interfaces";
import {
  ALL_TIME,
  AvatarNamesMap,
  LAST_MONTH,
  LAST_QUARTER,
  LAST_WEEK,
  PREV_MONTH,
  PREV_WEEK,
  YESTERDAY
} from "@shared/constants";
import moment from "moment";
import {ReportingService} from "../../reporting.service";
import {ReportingExportApiService} from "@api/reporting-export-api.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-project-logs-breakdown',
  templateUrl: './project-logs-breakdown.component.html',
  styleUrls: ['./project-logs-breakdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectLogsBreakdownComponent {
  @Input() show: boolean = false;
  @Input() project: IRPTTimeProject | null = null;
  @Input() isDurationLabelSelected = true;

  @Output() onClose: EventEmitter<boolean> = new EventEmitter<boolean>();

  loading = true;
  exporting = false;
  isDrawerDurationLabelSelected = false;

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
  selectedDuration: IRPTDuration | null = null;

  timelogsBreakDown: IProjectLogsBreakdown[] | null = null;

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  get durationLabel() {
    const f = "yy-MM-DD";
    if(this.isDrawerDurationLabelSelected) {
      return this.selectedDuration ? this.selectedDuration.label : "Duration";
    }

    if (this.dateRange.length == 2) {
      return `${moment(this.dateRange[0]).format(f)} - ${moment(this.dateRange[1]).format(f)}`;
    }

    return this.selectedDuration ? this.selectedDuration.label : "Duration";
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly reportingService: ReportingService,
    private readonly reportingExportApi: ReportingExportApiService,
    private readonly auth: AuthService
  ) {
  }

  handleCancel() {
    this.show = false;
    this.project = null;
    this.onClose.emit();
  }

  private async setDatesForKeys() {
    if(this.selectedDuration?.key) {
      const key = this.selectedDuration?.key;
      const today = moment();

      switch (key) {
        case YESTERDAY:
          const yesterday = moment().subtract(1, "days");
          this.dateRange = ([yesterday.toString(), yesterday.toString()]);
          break;
        case LAST_WEEK:
          const lastWeekStart = moment().subtract(1, "weeks");
          this.dateRange = ([lastWeekStart.toString(), today.toString()]);
          break;
        case LAST_MONTH:
          const lastMonthStart = moment().subtract(1, "months");
          this.dateRange = ([lastMonthStart.toString(), today.toString()]);
          break;
        case LAST_QUARTER:
          const lastQuaterStart = moment().subtract(3, "months");
          this.dateRange = ([lastQuaterStart.toString(), today.toString()]);
          break;
        case PREV_WEEK:
          const prevWeekStart = moment().subtract(1, "weeks").startOf("week");
          const prevWeekEnd = moment().subtract(1, "weeks").endOf("week");
          this.dateRange = ([prevWeekStart.toString(), prevWeekEnd.toString()]);
          break;
        case PREV_MONTH:
          const prevMonthStart = moment().subtract(1, "month").startOf("month");
          const prevMonthEnd = moment().subtract(1, "month").endOf("month");
          this.dateRange = ([prevMonthStart.toString(), prevMonthEnd.toString()]);
          break;
        case ALL_TIME:
          this.dateRange = [];
      }
    }
  }

  async get() {
    if (!this.project) return
    try {
      this.loading = true;
      if(this.isDrawerDurationLabelSelected) {
        await this.setDatesForKeys();
      }
      const body: ITimeLogBreakdownReq = {
        id: this.project.id,
        duration: this.selectedDuration ? this.selectedDuration.key : this.durations[1].key,
        date_range: this.dateRange,
        time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name as string : Intl.DateTimeFormat().resolvedOptions().timeZone as string
      }
      const res = await this.api.getProjectTimeLogs(body);
      if (res.done) {

        res.body.sort((a, b) => {
          const dateA = new Date(a.log_day);
          const dateB = new Date(b.log_day);
          return dateB.getTime() - dateA.getTime();
        });

        this.timelogsBreakDown = res.body;
      }
      this.loading = false;
      if(this.isDrawerDurationLabelSelected) this.dateRange = [];
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
  }

  async exportExcel() {
    if (!this.project) return
    try {
      this.exporting = false;
      if(this.isDrawerDurationLabelSelected) {
        await this.setDatesForKeys();
      }
      const body: ITimeLogBreakdownReq = {
        id: this.project.id,
        duration: this.selectedDuration ? this.selectedDuration.key : this.durations[1].key,
        date_range: this.dateRange,
        time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name as string : Intl.DateTimeFormat().resolvedOptions().timeZone as string
      }
      void this.reportingExportApi.exportProjectTimeLogs(body, this.project.name);
      this.exporting = false;
    } catch (e) {
      this.exporting = false;
      log_error(e);
    }
  }

  onVisibilityChange(visible: boolean) {
    if (visible) {
      const globalDuration = this.reportingService.getDuration()?.key;
      const globalDateRange = this.reportingService.getDateRange();

      if (globalDateRange.length === 2 && !this.isDurationLabelSelected) {
        this.dateRange = globalDateRange
      }

      this.isDrawerDurationLabelSelected = this.isDurationLabelSelected;

      const selectedItem = this.durations.find(d => d.key === globalDuration);
      if (selectedItem) this.selectedDuration = selectedItem;

      void this.get()
    } else {
      this.timelogsBreakDown = null;
      this.onClose.emit();
    }
  }

  onDurationChange(item: IRPTDuration) {
    this.dateRange = [];
    this.selectedDuration = item;
    this.isDrawerDurationLabelSelected = true;
    void this.get()
  }

  customDateChange() {
    this.isDrawerDurationLabelSelected = false;
    void this.get()
  }

}
