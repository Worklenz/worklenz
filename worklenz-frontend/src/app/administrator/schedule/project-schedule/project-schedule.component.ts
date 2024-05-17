import {Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges} from '@angular/core';
import {endOfWeek, format, startOfWeek} from "date-fns";
import {IResource, IScheduledTask} from "@interfaces/project-wise-resources-view-model";
import {EGanttColumnWidth, IGanttDateRange, IGanttWeekRange} from "@interfaces/gantt-chart";
import {ResourceAllocationService} from "@api/resource-allocation.service";
import {AvatarNamesMap} from "@shared/constants";
import {log_error} from "@shared/utils";
import {TaskViewService} from "../../components/task-view/task-view.service";
import {Subscription} from "rxjs";

@Component({
  selector: 'worklenz-project-schedule',
  templateUrl: './project-schedule.component.html',
  styleUrls: ['./project-schedule.component.scss']
})
export class ProjectScheduleComponent implements OnChanges, OnInit, OnDestroy {
  @Input() selectedWeek: { start: Date, end: Date } = {start: startOfWeek(new Date()), end: endOfWeek(new Date())};

  loading: boolean = false;
  visible = false;
  showTaskModal = false;

  resourceData: IResource[] = [];

  months: IGanttWeekRange[] = [];
  dates: IGanttDateRange[] = [];
  scheduledTasks: IScheduledTask[] = [];
  selectedTaskId: string | null = '';
  selectedResourceId: string | null = '';
  selectedDate: string | null = '';

  projectId: string = '';

  private tvRefreshSubscription!: Subscription;

  constructor(
    private api: ResourceAllocationService,
    private tvService: TaskViewService
  ) {
  }

  get title() {
    return `Scheduled tasks - ${this.selectedDate}`
  };

  open(): void {
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  ngOnInit(): void {
    this.tvRefreshSubscription = this.tvService.onRefresh.subscribe(() => {
      this.getResources();
    });
  }

  ngOnDestroy() {
    this.tvRefreshSubscription?.unsubscribe();
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  ngOnChanges(changes: SimpleChanges): void {
    const selectedWeek = changes['selectedWeek'];
    if (selectedWeek.currentValue !== selectedWeek.previousValue) {
      void this.getResources();
    }
  }

  async getResources() {
    try {
      this.loading = true;
      const res = await this.api.getProjectWiseResources(this.selectedWeek);

      if (res.done) {
        this.months = res.body.months;
        this.dates = res.body.dates;
        this.resourceData = res.body.projects;
        document.documentElement.style.setProperty('--column_count', this.dates.length.toString());
        document.documentElement.style.setProperty('--column_width', `${EGanttColumnWidth.DAYS}px`);
        document.documentElement.style.setProperty('--top-margin', '180px');
      }

      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
  }

  onTaskCreateOrUpdate() {
    this.getResources();
  }

  taskSelected(id: string = '', projectId: string = '') {
    this.projectId = projectId;
    this.selectedTaskId = id;
    this.showTaskModal = true;
  }

  scheduleClicked(scheduledTasks: IScheduledTask[], resourceId: string = '', date: string = '') {
    this.visible = true;
    this.selectedDate = format(new Date(date), 'yyyy-MM-dd');
    this.selectedResourceId = resourceId;
    this.scheduledTasks = scheduledTasks;
  }

  onVisibilityChange(visible: boolean) {
    if (visible) document.body.classList.add("task-form-drawer-opened");
  }
}
