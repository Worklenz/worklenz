import {Component, OnInit} from '@angular/core';
import {EResourceGanttColumn, EResourceGanttViewModes} from '@interfaces/gantt-chart';
import moment from 'moment/moment';
import {PersonalOverviewService} from '@api/personal-overview.service';
import {ITasksOverview} from '@interfaces/personal-overview';
import {GanttUtilsService} from '@services/gantt-utils.service';
import {format} from 'date-fns';
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzSegmentedModule} from "ng-zorro-antd/segmented";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {DatePipe, NgForOf, NgIf} from "@angular/common";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzButtonModule} from "ng-zorro-antd/button";
import {SafeStringPipe} from "@pipes/safe-string.pipe";

@Component({
  selector: 'worklenz-resource-gantt',
  templateUrl: './resource-gantt.component.html',
  styleUrls: ['./resource-gantt.component.scss'],
  imports: [
    NzLayoutModule,
    NzSegmentedModule,
    NzSkeletonModule,
    NgIf,
    NgForOf,
    NzTypographyModule,
    NzPopoverModule,
    NzButtonModule,
    DatePipe,
    SafeStringPipe
  ],
  standalone: true
})
export class ResourceGanttComponent implements OnInit {
  options = ['Weekly', 'Monthly', 'Quarterly'];
  viewMode: EResourceGanttViewModes = 0;
  columnWidth: number = EResourceGanttColumn.WEEKS;
  ganttChartScaleModes = EResourceGanttViewModes;

  todayIndex = 0;

  chartStartDate: string = moment().subtract(4, 'months').format('YYYY-MM-DD');
  chartEndDate: string = moment().add(4, 'months').format('YYYY-MM-DD');

  dates: { isSunday: boolean, isWeekend: boolean, isToday: string, isLastDayOfWeek: string, date: Date }[] = [];
  weeks: any = [];
  months: any[] = [];

  loadingTasks = false;

  projects: ITasksOverview[] = [];

  constructor(
    private personalOverviewService: PersonalOverviewService,
    private dateUtilsService: GanttUtilsService
  ) {
  }

  ngOnInit(): void {
    this.getTasksRange().then(r => r);
  }

  async getTasksRange() {
    try {
      this.loadingTasks = true;
      const res = await this.personalOverviewService.getTasksOverview(this.chartStartDate, this.chartEndDate);
      if (res.done) {
        this.projects = res.body;
        this.dates = await this.dateUtilsService.getDates(this.chartStartDate, this.chartEndDate);
        this.weeks = await this.dateUtilsService.getWeekRange(this.dates);
        this.months = await this.dateUtilsService.getMonthRange(this.dates);

        document.documentElement.style.setProperty('--column_count', this.dates.length.toString());
        document.documentElement.style.setProperty('--column_width', `${EResourceGanttColumn.WEEKS}px`);
        document.documentElement.style.setProperty('--top_margin', '290px');

        this.todayIndex = this.dates.findIndex(e => format(new Date(), 'dd-MM-yyyy') === format(e.date, 'dd-MM-yyyy'));

        if (this.todayIndex !== -1) await this.scrollToDate(this.todayIndex);

      }
      this.loadingTasks = false;
    } catch (e) {
      this.loadingTasks = false;
    }
  }

  async getColumnWidth(viewMode: EResourceGanttViewModes) {
    if (viewMode === EResourceGanttViewModes.WEEKS) return EResourceGanttColumn.WEEKS;
    return viewMode === EResourceGanttViewModes.QUARTERS ? EResourceGanttColumn.QUARTERS : EResourceGanttColumn.MONTHS;
  }

  async changeViewMode(viewMode: EResourceGanttViewModes) {
    this.viewMode = viewMode;
    this.columnWidth = await this.getColumnWidth(viewMode || EResourceGanttViewModes.WEEKS);
    document.documentElement.style.setProperty('--column_width', `${this.columnWidth}px`);
    if (this.todayIndex !== -1) await this.scrollToDate(this.todayIndex);
  }

  setRange(minDate: Date = new Date(), maxDate: Date = new Date()) {
    const startDateIndex = this.dates.findIndex((date) => moment(minDate || moment().subtract(2, 'days').format('YYYY-MM-DD')).isSame(date.date, 'days'));
    const endDateIndex = this.dates.findIndex((date) => moment(maxDate || moment().add(2, 'days').format('YYYY-MM-DD')).isSame(date.date, 'days'));

    return `${startDateIndex + 1} / ${endDateIndex + 2}`;
  }

  getMonthRange(min: number, max: number) {
    return `${min + 1} / ${max + 2}`;
  }

  async scrollToDate(todayIndex: number) {
    setTimeout(() => {
      document.getElementById(`date_${todayIndex}`)?.scrollIntoView({
        behavior: 'auto', block: 'center', inline: 'center'
      });
    }, 50);
  }
}
