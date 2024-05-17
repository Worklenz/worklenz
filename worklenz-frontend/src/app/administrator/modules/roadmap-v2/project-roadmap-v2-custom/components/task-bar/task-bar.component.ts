import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  Renderer2
} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskListGroup} from "../../../../task-list-v2/interfaces";
import {IDragReturn} from "@interfaces/workload";
import {SocketEvents} from "@shared/socket-events";
import {ProjectRoadmapApiService} from "@api/project-roadmap-api.service";
import {Socket} from "ngx-socket-io";
import {RoadmapV2HashmapService} from "../../services/roadmap-v2-hashmap.service";
import {RoadmapV2Service} from "../../services/roadmap-v2-service.service";
import {IDateVerificationResponse, ITaskDragResponse, ITaskResizeResponse} from "@interfaces/roadmap";
import moment, {Moment} from "moment";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {formatGanttDate} from "@shared/utils";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-bar',
  templateUrl: './task-bar.component.html',
  styleUrls: ['./task-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskBarComponent implements OnInit, OnDestroy {
  @HostBinding("class") cls = "h-100 d-flex align-items-center";
  @Input({required: true}) task: IProjectTask | null = null;
  @Input() parentTask: string | null = null;
  @Input({required: true}) group: ITaskListGroup | null = null;
  @Input({required: true}) chartStart: string | null = null;
  @Input({required: true}) chartEnd: string | null = null;
  @Output() openTask = new EventEmitter<IProjectTask>();
  @Output() refreshChart = new EventEmitter<boolean>();
  @Output() scrollChange = new EventEmitter<number>();

  protected readonly GANNT_COLUMN_WIDTH = 35;
  isResized = false;

  showIndicators = false

  constructor(
    private readonly api: ProjectRoadmapApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly socket: Socket,
    private readonly map: RoadmapV2HashmapService,
    public readonly service: RoadmapV2Service,
    private renderer: Renderer2,
    private readonly auth: AuthService,
  ) {
    this.service.onResizeEnd
      .pipe(takeUntilDestroyed())
      .subscribe((response: IDateVerificationResponse) => {
        this.verifyDateChanges(response);
      })

    this.service.onShowIndicators.pipe(takeUntilDestroyed()).subscribe((taskId) => {
      if (this.task?.id === taskId) {
        this.showIndicators = true;
        this.cdr.markForCheck()
      }
    })

    this.service.onRemoveIndicators.pipe(takeUntilDestroyed()).subscribe((taskId) => {
      if (this.task?.id === taskId) {
        this.showIndicators = false;
        this.cdr.markForCheck()
      }
      this.service.highlighterLeft = 0;
      this.service.highlighterWidth = 0;
    })

  }

  ngOnInit() {
    this.socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.handleStartDateChangeResponse);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.handleEndDateChangeResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.handleStartDateChangeResponse);
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.handleEndDateChangeResponse);
  }

  async onElementDragged(dragResponse: IDragReturn, task: IProjectTask, groupId: string) {
    if (!task) return;
    if (dragResponse.dragDifference == 0) {
      return this.openTask.emit(task);
    }
    if (dragResponse.finalLeft === task.offset_from) {
      task.offset_from = dragResponse.finalLeft - 1;
    }
    const diff = (dragResponse.finalLeft % this.GANNT_COLUMN_WIDTH);
    this.socket.emit(SocketEvents.GANNT_DRAG_CHANGE.toString(), JSON.stringify({
      task_id: task.id,
      task_width: task.width,
      task_duration: task.width ? task.width / this.GANNT_COLUMN_WIDTH : 0,
      task_offset: dragResponse.finalLeft - diff,
      from_start: (dragResponse.finalLeft - diff) / this.GANNT_COLUMN_WIDTH,
      chart_start: this.chartStart,
      group_id: groupId,
      time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
    }));
    this.socket.once(SocketEvents.GANNT_DRAG_CHANGE.toString(), (response: ITaskDragResponse) => {
      if (moment((moment(response.end_date).format("YYYY-MM-DD"))).isSameOrAfter(moment(this.chartEnd).format("YYYY-MM-DD")) || moment((moment(response.start_date).format("YYYY-MM-DD"))).isBefore(moment(this.chartStart).format("YYYY-MM-DD"))) {
        this.refreshChart.emit(true);
        return;
      }

      this.service.handleTaskDragFinish(response);
      this.service.emitRemoveIndicators(response.task_id);
      this.scrollChange.emit(response.task_offset - (2 * this.GANNT_COLUMN_WIDTH));
      this.cdr.markForCheck();
    })
  }

  onResizeStart(event: MouseEvent, task: IProjectTask, direction: 'left' | 'right', taskBar: HTMLDivElement): void {
    if (!task || !task.width || !task.offset_from) {
      return;
    }
    this.isResized = false;
    this.service.top = 0;
    this.service.emitShowIndicators(this.task?.id as string);
    const startX = event.clientX;
    const startWidth = task.width;
    const startLeft = task.offset_from;
    const fChartStart = moment(this.chartStart).format("YYYY-MM-DD");
    const chartStart = moment(fChartStart);

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;

      let newWidth = startWidth;
      let newLeft = startLeft;

      if (direction === 'left') {
        newWidth = startWidth - deltaX;
        newLeft = startLeft + deltaX;
      } else if (direction === 'right') {
        newWidth = startWidth + deltaX;
      }
      this.service.highlighterLeft = newLeft;
      this.service.highlighterWidth = newWidth;
      this.cdr.markForCheck();

      if (newWidth >= this.GANNT_COLUMN_WIDTH - 3) {
        task.width = newWidth;
        task.offset_from = newLeft;
        this.isResized = true;
        this.cdr.markForCheck();
      }
    };

    const onMouseUp = () => {
      this.isResized = true;

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (direction === 'left') {
        const diff = task.offset_from ? task.offset_from % this.GANNT_COLUMN_WIDTH : 0;
        const fromStart = task.offset_from ? (task.offset_from - diff) / this.GANNT_COLUMN_WIDTH : 0;
        const taskStartDate = chartStart.add(fromStart, "days");

        this.socket.emit(
          SocketEvents.TASK_START_DATE_CHANGE.toString(), JSON.stringify({
            task_id: task.id,
            start_date: (taskStartDate),
            parent_task: this.parentTask ? this.parentTask : null,
            group_id: this.group?.id,
            time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
          }));

        // task.offset_from = task.offset_from ? task.offset_from - diff : 0;
      }
      if (direction === 'right') {
        const diff = task.width ? task.width % this.GANNT_COLUMN_WIDTH : 0;
        let taskWidth = task.width;
        if(diff > 0) {
          taskWidth = task.width ? task.width + (this.GANNT_COLUMN_WIDTH - diff) : 0;
        }
        if (!taskWidth) return;

        const duration = task.offset_from ? (task.offset_from + taskWidth) / this.GANNT_COLUMN_WIDTH : 0;
        const taskEndDate = moment(fChartStart).add(duration - 1, "days")

        this.socket.emit(
          SocketEvents.TASK_END_DATE_CHANGE.toString(), JSON.stringify({
            task_id: task.id,
            end_date: (taskEndDate),
            parent_task: this.parentTask ? this.parentTask : null,
            group_id: this.group?.id,
            time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
          }));

        // task.offset_from = task.offset_from ? task.offset_from + taskWidth : 0;
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }


  handleStartDateChangeResponse = async (response: ITaskResizeResponse) => {
    if (!this.task) return;
    if (this.task.id === response.id) {
      const fChartStartDate = moment(this.chartStart).format("YYYY-MM-DD");
      const fChartEndDate = moment(this.chartEnd).format("YYYY-MM-DD");
      const chartStartDate = moment(fChartStartDate);
      const chartEndDate = moment(fChartEndDate);
      this.service.handleStartDateChange(response, chartStartDate, chartEndDate);
    }
  };

  handleEndDateChangeResponse = async (response: ITaskResizeResponse) => {
    if (!this.task) return;
    if (this.task.id === response.id) {
      const fChartStartDate = moment(this.chartStart).format("YYYY-MM-DD");
      const fChartEndDate = moment(this.chartEnd).format("YYYY-MM-DD");
      const chartStartDate = moment(fChartStartDate);
      const chartEndDate = moment(fChartEndDate);
      this.service.handleEndDateChange(response, chartStartDate, chartEndDate);
    }
  }

  verifyDateChanges(response: IDateVerificationResponse) {
    const fToday = moment().format("YYYY-MM-DD");
    const today = moment(fToday);

    if (response.taskStartDate && !response.taskEndDate) {
      this.handleTaskPositionSTDOnly(response.taskStartDate, response.chartStartDate, response.task);
    } else if (!response.taskStartDate && response.taskEndDate) {
      this.handleTaskPositionENDOnly(response.taskEndDate, response.chartStartDate, response.task);
    } else if (!response.taskStartDate && !response.taskEndDate) {
      this.handleTaskPositionBothNull(today, response.chartStartDate, response.task);
    } else if (response.taskStartDate && response.taskEndDate) {
      this.handleTaskPositionBothHave(response.taskStartDate, response.taskEndDate, response.chartStartDate, response.task);
    }

    this.service.emitRemoveIndicators(this.task?.id as string);
  }

  handleTaskPositionSTDOnly(startDate: string, chartStartDate: Moment, task: IProjectTask) {
    const fTaskStartDate = moment(startDate).format("YYYY-MM-DD");
    const taskStartDate = moment(fTaskStartDate);
    const fromStart = taskStartDate.diff(chartStartDate, "day");
    task.offset_from = fromStart * this.GANNT_COLUMN_WIDTH;
    task.width = this.GANNT_COLUMN_WIDTH;
    this.cdr.markForCheck();
  }

  handleTaskPositionENDOnly(endDate: string, chartStartDate: Moment, task: IProjectTask) {
    const fTaskEndDate = moment(endDate).format("YYYY-MM-DD");
    const taskEndDate = moment(fTaskEndDate);
    const fromStart = taskEndDate.diff(chartStartDate, "day");
    task.offset_from = fromStart * this.GANNT_COLUMN_WIDTH;
    task.width = this.GANNT_COLUMN_WIDTH;
    this.cdr.markForCheck();
  }

  handleTaskPositionBothNull(today: Moment, chartStartDate: Moment, task: IProjectTask) {
    const fromStart = today.diff(chartStartDate, "day");
    task.offset_from = fromStart * this.GANNT_COLUMN_WIDTH;
    task.width = this.GANNT_COLUMN_WIDTH;
    this.cdr.markForCheck();
  }

  handleTaskPositionBothHave(startDate: string, endDate: string, chartStartDate: Moment, task: IProjectTask) {
    const fTaskStartDate = moment(startDate).format("YYYY-MM-DD");
    const taskStartDate = moment(fTaskStartDate);
    const fromStart = taskStartDate.diff(chartStartDate, "day");
    const fTaskEndDate = moment(endDate).format("YYYY-MM-DD");
    const taskEndDate = moment(fTaskEndDate);
    const taskDuration = taskEndDate.diff(taskStartDate, "day");
    task.offset_from = fromStart * this.GANNT_COLUMN_WIDTH;
    task.width = (taskDuration + 1) * this.GANNT_COLUMN_WIDTH;
    this.cdr.markForCheck();
  }

}
