import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {ISingleMonth, IWLMember} from "@interfaces/workload";
import {log_error} from "@shared/utils";
import {AvatarNamesMap, DRAWER_ANIMATION_INTERVAL, GANNT_COLUMN_WIDTH} from "@shared/constants";
import {ActivatedRoute} from "@angular/router";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {ProjectWorkloadApiService} from "@api/project-workload-api.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {WlTasksService} from "./services/wl-tasks.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {AuthService} from "@services/auth.service";
import {TaskTimerService} from "@admin/components/task-timer/task-timer.service";

@Component({
  selector: 'worklenz-workload-gaant-chart-v2',
  templateUrl: './workload-gaant-chart-v2.component.html',
  styleUrls: ['./workload-gaant-chart-v2.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class WorkloadGaantChartV2Component implements OnInit, OnDestroy {
  @ViewChild('scroller') scroller?: ElementRef;
  @ViewChild('fixed_right_column') fixed_right_column?: ElementRef;
  @ViewChild('fixed_left_column') fixed_left_column?: ElementRef;
  @ViewChild('custom_tooltip_element') custom_tooltip_element?: ElementRef;
  @ViewChildren('duration_indicator') duration_indicators?: QueryList<ElementRef>;

  protected readonly GANNT_COLUMN_WIDTH = 30;
  protected showTaskModal = false;
  protected showMemberModal = false;
  protected selectedTaskId: string | null = null;
  protected selectedTeamMember: IWLMember | null = null;

  initialScroll = 0;
  numberOfDays: number = 0;
  activeTab = 0;

  projectId: string | null = null;
  chartStart: string | null = null;
  chartEnd: string | null = null;
  customToolTipStartDate: string | null = null;
  customToolTipEndDate: string | null = null;
  customToolTipLeft: number | null = null;
  customToolTipTop: number | null = null;

  months: ISingleMonth[] = []
  workloadMembers: IWLMember[] = [];
  selectedTask: IProjectTask | null = null;

  loading = false;
  isResized = false;

  constructor(
    private readonly api: ProjectWorkloadApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly socket: Socket,
    private route: ActivatedRoute,
    private readonly service: WlTasksService,
    private readonly taskViewService: TaskViewService,
    private readonly auth: AuthService,
    private readonly timerService: TaskTimerService
  ) {
    this.projectId = this.route.snapshot.paramMap.get("id");

    this.taskViewService.onViewBackFrom
      .pipe(takeUntilDestroyed())
      .subscribe(task => {
        const task_: IProjectTask = {
          id: task.parent_task_id,
          project_id: task.project_id,
        }
        this.handleTaskSelectFromView(task_);
      });

    this.taskViewService.onDelete
      .pipe(takeUntilDestroyed())
      .subscribe(async task => {
        if (task.parent_task_id) {
          const task_: IProjectTask = {
            id: task.parent_task_id,
            project_id: this.projectId as string
          }
          this.handleTaskSelectFromView(task_);
        }
        await this.refresh(false);
      })

    this.service.onRemoveMembersTask.pipe(takeUntilDestroyed()).subscribe(async(taskId: string) => {
      await this.refresh(false);
    })

    this.timerService.onSubmitOrUpdate.pipe(takeUntilDestroyed()).subscribe(async() => {
      await this.refresh(false);
    })

    this.service.onRefreshMembers().pipe(takeUntilDestroyed()).subscribe(
      async() => {
        await this.getMembers(false);
      }
    )
    this.taskViewService.onSingleMemberChange.pipe(takeUntilDestroyed())
      .subscribe((teamMemberId: string) => {
        void this.init(false);
      });

  }

  async ngOnInit() {
    await this.init(true);
    this.socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.refresh);
    this.socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_START_DATE_CHANGE.toString(), this.refresh);
    this.socket.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), this.refresh);
  }

  refresh = async (response: any) => {
    await this.init(false);
  }

  async init(isLoading: boolean) {
    await this.createChart(isLoading);
    await this.getMembers(isLoading);
  }

  async createChart(isLoading: boolean) {
    if (!this.projectId || !this.auth.getCurrentSession()?.timezone_name) return;
    try {
      this.loading = isLoading;
      const res = await this.api.getGanntDates(this.projectId, this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name as string : Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (res.done) {
        this.months = res.body.date_data;
        this.numberOfDays = res.body.width;
        this.initialScroll = res.body.scroll_by;
        this.chartStart = res.body.chart_start;
        this.chartEnd = res.body.chart_end;
      }
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async getMembers(scroll: boolean) {
    if (!this.projectId || !this.auth.getCurrentSession()?.timezone_name) return;
    try {
      const res = await this.api.getWorkloadMembers(this.projectId, this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name as string : Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (res.done) {
        this.workloadMembers = res.body;
        await this.initScrollHandler(scroll);
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  async initScrollHandler(needed: boolean) {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (this.fixed_right_column && needed) {
          this.fixed_right_column.nativeElement.scrollLeft = this.initialScroll - (2 * GANNT_COLUMN_WIDTH);
          this.scrollListner();
        }
      }, 100)
    });
    this.loading = false;
    this.cdr.markForCheck();
  }

  afterViewScrollHandler(fromLeft: number) {
    this.ngZone.runOutsideAngular(() => {
      if (this.fixed_right_column) {
        this.fixed_right_column.nativeElement.classList.add('scroll-animation');
        this.fixed_right_column.nativeElement.scrollLeft = fromLeft - (2 * GANNT_COLUMN_WIDTH);
        setTimeout(() => {
          if (this.fixed_right_column) {
            this.fixed_right_column.nativeElement.classList.remove('scroll-animation');
          }
        }, 125);
      }
    });
    this.cdr.markForCheck();
  }

  scrollListner() {
    this.ngZone.runOutsideAngular(() => {
      this.fixed_left_column?.nativeElement.addEventListener('scroll', () => {
        if (this.fixed_right_column) this.fixed_right_column.nativeElement.scrollTop = this.fixed_left_column?.nativeElement.scrollTop;
      });
      this.fixed_right_column?.nativeElement.addEventListener('scroll', () => {
        if (this.fixed_left_column) this.fixed_left_column.nativeElement.scrollTop = this.fixed_right_column?.nativeElement.scrollTop;
      });
    })
  }

  private handleTaskSelectFromView(task: IProjectTask) {
    this.showTaskModal = false;
    setTimeout(() => {
      if (task) {
        this.openTask(task);
      }
    }, DRAWER_ANIMATION_INTERVAL);
    this.cdr.detectChanges();
  }

  protected openTask(task: IProjectTask) {
    this.selectedTask = task;
    this.showTaskModal = true;
    this.cdr.markForCheck();
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.selectedTask = null;
    }
  }

  protected openMember(member: IWLMember, tab: number) {
    this.selectedTeamMember = member;
    this.activeTab = tab;
    this.showMemberModal = true;
    this.cdr.markForCheck();
  }

  hoverInIndicator(elem: HTMLDivElement, highlighter: HTMLDivElement, colorCode: string, event: MouseEvent, member: IWLMember) {
    this.ngZone.runOutsideAngular(() => {
      this.setIndicatorHoverStyle(elem, colorCode);
      this.setHighlighterStyle(highlighter, elem, colorCode);
      this.setCustomTooltipStyle(event, member);
      this.cdr.detectChanges();
    });
  }

  hoverOutIndicator(elem: HTMLDivElement, highlighter: HTMLDivElement) {
    this.ngZone.runOutsideAngular(() => {
      this.removeIndicatorHoverStyle(elem);
      this.removeHighlighterStyle(highlighter);
      this.removeCustomTooltipStyle();
      this.cdr.detectChanges();
    });
  }

  hoverInMember(index: number, highlighter: HTMLDivElement, colorCode: string) {
    this.ngZone.runOutsideAngular(() => {
      if (this.duration_indicators) {
        const elem: HTMLDivElement = this.duration_indicators.toArray()[index].nativeElement;
        this.setIndicatorHoverStyle(elem, colorCode);
        this.setHighlighterStyle(highlighter, elem, colorCode);
        this.cdr.detectChanges();
      }
    });
  }

  hoverOutMember(index: number, highlighter: HTMLDivElement) {
    this.ngZone.runOutsideAngular(() => {
      if (this.duration_indicators) {
        const elem: HTMLDivElement = this.duration_indicators.toArray()[index].nativeElement;
        this.removeIndicatorHoverStyle(elem);
        this.removeHighlighterStyle(highlighter);
        this.cdr.detectChanges();
      }
    });
  }

  setIndicatorHoverStyle(elem: HTMLDivElement, colorCode: string) {
    elem.style.backgroundColor = colorCode + "69";
    elem.style.borderColor = "transparent";
    elem.style.top = '7px';
    elem.style.bottom = '7px';
  }

  removeIndicatorHoverStyle(elem: HTMLDivElement) {
    elem.style.backgroundColor = '#d9e3ee';
    elem.style.borderColor = "#adb5bd";
    elem.style.top = '10px';
    elem.style.bottom = '10px';
  }

  setHighlighterStyle(highlighter: HTMLDivElement, elem: HTMLDivElement, colorCode: string) {
    highlighter.style.backgroundColor = colorCode + "70";
    highlighter.style.left = elem.style.left;
    highlighter.style.width = elem.style.width;
  }

  removeHighlighterStyle(highlighter: HTMLDivElement) {
    highlighter.style.backgroundColor = "transparent";
    highlighter.style.left = '0px';
    highlighter.style.width = '0px';
  }

  setCustomTooltipStyle(event: MouseEvent, member: IWLMember) {
    this.customToolTipLeft = event.clientX + 15;
    this.customToolTipTop = event.clientY;
    this.customToolTipStartDate = member.tasks_start_date;
    this.customToolTipEndDate = member.tasks_end_date;
    if (this.custom_tooltip_element) {
      this.custom_tooltip_element.nativeElement.style.opacity = 1;
      this.custom_tooltip_element.nativeElement.style.scale = 1;
    }
    this.cdr.detectChanges();
  }

  removeCustomTooltipStyle() {
    this.customToolTipLeft = null;
    this.customToolTipTop = null;
    this.customToolTipStartDate = null;
    this.customToolTipEndDate = null;
    if (this.custom_tooltip_element) {
      this.custom_tooltip_element.nativeElement.style.opacity = 0;
      this.custom_tooltip_element.nativeElement.style.scale = 0;
    }
  }

}
