import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {NzPageHeaderModule} from "ng-zorro-antd/page-header";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, YESTERDAY, ALL_TIME, PREV_WEEK, PREV_MONTH} from "@shared/constants";
import {IDurationChangedEmitter, IRPTDuration} from "../../interfaces";
import {NzDatePickerModule} from "ng-zorro-antd/date-picker";
import {NzFormModule} from "ng-zorro-antd/form";
import moment, {duration} from "moment/moment";
import {ReportingService} from "../../reporting.service";

@Component({
  selector: 'worklenz-rpt-header',
  templateUrl: './rpt-header.component.html',
  styleUrls: ['./rpt-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NzPageHeaderModule,
    NzIconModule,
    NzSpaceModule,
    NzButtonModule,
    NgClass,
    FormsModule,
    NzCheckboxModule,
    NzDropDownModule,
    NgForOf,
    NzDatePickerModule,
    NzFormModule,
    NgIf
  ],
  standalone: true
})
export class RptHeaderComponent implements OnInit {
  @Input({required: true}) title!: string;
  @Input() showExport = true;
  @Input() showDuration = true;
  @Input() showArchivedToggle = true;
  @Input() isPngOnly = false;
  @Output() durationChanged: EventEmitter<IDurationChangedEmitter> = new EventEmitter<IDurationChangedEmitter>();
  @Output() exportFile = new EventEmitter<void>();
  @Output() isDurationLabelSelected = new EventEmitter<boolean>();

  includeArchived = false;
  exporting = false;

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
    return this.api.getDuration();
  }

  constructor(
    private api: ReportingService
  ) {
  }

  ngOnInit() {
    this.setInitialValues();

  }

  setInitialValues() {
    if (!this.api.getDuration())
      this.api.setDuration(this.durations.find(d => d.key === LAST_WEEK) || null);

    if (this.api.getIncludeToggle())
      this.includeArchived = this.api.getIncludeToggle();
  }

  onArchiveChange(event: any) {
    this.api.setIncludeToggle(event);
    this.api.emitIncludeToggleChanged();
  }

  onDurationChange(item: IRPTDuration) {
    this.isDurationLabelSelected.emit(true);
    setTimeout(() => {
      this.api.setDuration(item);
      this.api.setDrawerDuration(item);
      this.dateRange = [];
      this.api.setDateRange(this.dateRange);
      this.api.setDrawerDateRange(this.dateRange);
      this.api.emitDurationChanged();
    }, 500);
  }

  customDateChange() {
    this.isDurationLabelSelected.emit(false);
    setTimeout(() => {
      this.api.setDateRange(this.dateRange);
      this.api.setDrawerDateRange(this.dateRange);
      this.api.emitDateRangeChanged();
    })
  }

  export() {
    this.exportFile.emit();
  }

}
