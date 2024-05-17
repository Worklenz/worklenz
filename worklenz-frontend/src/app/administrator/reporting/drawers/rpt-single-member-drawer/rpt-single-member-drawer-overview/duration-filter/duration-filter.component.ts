import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {IRPTDuration} from "../../../../interfaces";
import moment from "moment/moment";
import {ReportingService} from "../../../../reporting.service";
import {ReportingExportApiService} from "@api/reporting-export-api.service";
import {AuthService} from "@services/auth.service";
import {LogHeaderService} from "../service/log-header.service";

@Component({
  selector: 'worklenz-single-member-duration-filter',
  templateUrl: './duration-filter.component.html',
  styleUrls: ['./duration-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DurationFilterComponent implements OnInit {
  @Output() getResult = new EventEmitter();

  constructor(
    private readonly cdr: ChangeDetectorRef,
    public readonly service: LogHeaderService,
    private readonly reportingService: ReportingService,
    private readonly reportingExportApi: ReportingExportApiService,
    private readonly auth: AuthService
  ) {
  }

  ngOnInit() {
    this.setMembersDrawerDuration();
    this.cdr.markForCheck();
  }


  private setMembersDrawerDuration() {

    const globalDuration = this.reportingService.getDuration()?.key;
    const globalDateRange = this.reportingService.getDateRange();

    if (globalDateRange.length === 2) {
      this.service.dateRange = globalDateRange
      this.cdr.markForCheck();
    } else {
      const selectedItem = this.service.durations.find(d => d.key === globalDuration);
      if (selectedItem) this.service.selectedDuration = selectedItem;
      this.cdr.markForCheck();
    }
  }

  onDurationChange(item: IRPTDuration) {
    this.service.dateRange = [];
    this.service.selectedDuration = item;
    this.service.emitDurationChange();
    this.cdr.markForCheck();
  }

  get durationLabel() {
    const f = "yy-MM-DD";
    if (this.service.dateRange.length == 2)
      return `${moment(this.service.dateRange[0]).format(f)} - ${moment(this.service.dateRange[1]).format(f)}`;
    return this.service.selectedDuration ? this.service.selectedDuration.label : "Duration";
  }

  customDateChange() {
    this.service.emitDurationChange();
    this.cdr.markForCheck();
  }
}
