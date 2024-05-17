import {Component, OnInit, ViewChild} from '@angular/core';
import { startOfWeek, startOfMonth} from "date-fns"
import {ProjectScheduleComponent} from "../project-schedule/project-schedule.component";
import {TeamScheduleComponent} from "../team-schedule/team-schedule.component";
import {SchedulerCommonService} from "../schedule-v2/service/scheduler-common.service";

enum ResourceGanttTypes {
  'Projects', 'Teams'
}

@Component({
  selector: 'worklenz-schedule-view',
  templateUrl: './schedule-view.component.html',
  styleUrls: ['./schedule-view.component.scss']
})
export class ScheduleViewComponent {
  @ViewChild(ProjectScheduleComponent) projectsSchedule: ProjectScheduleComponent | undefined;
  @ViewChild(TeamScheduleComponent) teamSchedule: TeamScheduleComponent | undefined;

  options = [ResourceGanttTypes[0], ResourceGanttTypes[1]];
  selectedChartType: ResourceGanttTypes = ResourceGanttTypes.Projects;

  dateRange: Date | null = null;

  dateModes = [
    {
      value: 0,
      label: 'Week'
    },
    {
      value: 1,
      label: 'Month'
    }
  ]

  dateModeModel = 0;

  constructor(
    private readonly service: SchedulerCommonService
  ) {
  }

  dateModeChange(value: number) {
    this.dateModeModel = value;
  }

  disabledDate = (current: Date): boolean => {
    if (this.service.startDate && this.service.endDate) {
      return current < new Date(this.service.startDate) || current > new Date(this.service.endDate);
    }
    return false;
  }

  onChange(event: any) {
    if (event) {
      if (this.dateModeModel === 0) this.service.scrollToDay(new Date(startOfWeek(event)));
      if (this.dateModeModel === 1) this.service.scrollToDay(new Date(startOfMonth(event)));
    }
  }

  scrollToday() {
    this.service.scrollToDay(new Date());
  }
}
