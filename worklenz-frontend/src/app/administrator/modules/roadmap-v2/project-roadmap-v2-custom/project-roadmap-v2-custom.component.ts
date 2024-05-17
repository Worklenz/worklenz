import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone, OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {ISingleMonth} from "@interfaces/workload";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ProjectRoadmapApiService} from "@api/project-roadmap-api.service";
import {Socket} from "ngx-socket-io";
import {ActivatedRoute} from "@angular/router";
import {deepClone, log_error} from "@shared/utils";
import {IRoadmapConfigV2} from "@interfaces/roadmap";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IGroupByOption, ITaskListGroup} from "../../task-list-v2/interfaces";
import {RoadmapV2HashmapService} from "./services/roadmap-v2-hashmap.service";
import {RoadmapV2Service} from "./services/roadmap-v2-service.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {ProjectsService} from "../../../projects/projects.service";
import {DRAWER_ANIMATION_INTERVAL, UNMAPPED} from "@shared/constants";
import {ITaskViewTaskIds} from "@admin/components/task-view/interfaces";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-project-roadmap-v2-custom',
  templateUrl: './project-roadmap-v2-custom.component.html',
  styleUrls: ['./project-roadmap-v2-custom.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectRoadmapV2CustomComponent implements OnInit, OnDestroy {
  @ViewChild('scroller') scroller?: ElementRef;
  @ViewChild('fixed_right_column') fixed_right_column?: ElementRef;
  @ViewChild('fixed_left_column') fixed_left_column?: ElementRef;
  @ViewChildren('task_elem') taskElements!: QueryList<ElementRef>;

  protected readonly Number = Number;
  protected readonly GANNT_COLUMN_WIDTH = 35;
  protected showTaskModal = false;

  loading = false;

  initialScroll = 0;
  numberOfDays: number = 0;

  projectId: string | null = null;
  chartStart: string | null = null;
  chartEnd: string | null = null;

  months: ISingleMonth[] = [];
  protected groupIds: string[] = [];
  selectedTask: IProjectTask | null = null;

  protected get groups() {
    return this.service.groups;
  }

  protected get expandedGroups() {
    const filter = this.groups.filter(m => m.is_expanded);
    const ids = filter.map(m => m.id) as string[];
    return ids || [];
  }

  private isGroupByPhase() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_PHASE_VALUE;
  }

  constructor(
    private readonly api: ProjectRoadmapApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly map: RoadmapV2HashmapService,
    public readonly service: RoadmapV2Service,
    private readonly taskViewService: TaskViewService,
    private readonly projectService: ProjectsService,
    private route: ActivatedRoute,
    private readonly auth: AuthService,
  ) {
    this.service.onReCreateChart
      .pipe(takeUntilDestroyed())
      .subscribe((loading: boolean) => {
        void this.init(loading);
      })

    this.projectService.onNewTaskCreated
      .pipe(takeUntilDestroyed())
      .subscribe((task: IProjectTask) => {
        const groupId = this.isGroupByPhase() ? UNMAPPED : this.service.getGroupIdByGroupedColumn(task);
        if (groupId)
          this.service.addTask(task, groupId);
      })

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
      .subscribe((task) => {
        if (task.parent_task_id) {
          if (this.map._subTasksMap.has(task.parent_task_id)) {
            this.deleteSubtask(task);
          }
        } else {
          this.map.selectTask(task as IProjectTask);
          this.service.deleteTask(task.id);
          this.cdr.detectChanges();
        }
      })

    this.projectId = this.route.snapshot.paramMap.get("id");
    this.service.setCurrentGroup(this.service.GROUP_BY_OPTIONS[0]);
  }

  async ngOnInit() {
    await this.init(true);
  }

  async ngOnDestroy() {
    this.service.reset();
  }

  async init(isLoading: boolean) {
    await this.createChart(isLoading);
    await this.getGroups(true);
  }

  private async createChart(loading: boolean) {
    if (!this.projectId) return;
    try {
      this.loading = loading;
      const timeZone = this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name as string : Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await this.api.getGanntDates(this.projectId, timeZone);
      if (res.done) {
        this.months = res.body.date_data;
        this.numberOfDays = res.body.width;
        this.initialScroll = res.body.scroll_by;
        this.service.offset = res.body.scroll_by;
        this.chartStart = res.body.chart_start;
        this.chartEnd = res.body.chart_end;
        this.service.chartStartDate = res.body.chart_start;
      }
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e)
    }
  }

  protected async onGroupByChange(group: IGroupByOption) {
    this.loading = true;
    this.service.setCurrentGroup(group);
    await this.getGroups(false);
    setTimeout(() => {
      this.cdr.markForCheck();
    }, 100); // wait for animations to be finished
  }

  private getConf(parentTaskId?: string): IRoadmapConfigV2 {
    const config: IRoadmapConfigV2 = {
      id: this.projectId as string,
      group: this.service.getCurrentGroup().value,
      timezone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name as string : Intl.DateTimeFormat().resolvedOptions().timeZone,
      isSubtasksInclude: false,
      expandedGroups: this.expandedGroups
    };

    if (parentTaskId)
      config.parent_task = parentTaskId;

    return config;
  }

  private async getGroups(isExpandInclude: boolean) {
    if (!this.projectId) return;
    try {
      this.map.deselectAll();
      const config = this.getConf();
      if (!isExpandInclude) config.expandedGroups = [];
      config.isSubtasksInclude = this.service.isSubtasksIncluded;
      const res = await this.api.getTaskGroups(config) as IServerResponse<ITaskListGroup[]>;
      if (res.done) {
        const groups = deepClone(res.body);
        this.groupIds = groups.map((g: ITaskListGroup) => g.id);
        this.mapTasks(groups);
        this.service.groups = groups;
        this.loading = false;
        this.cdr.markForCheck();
        await this.initScrollHandler(true);
      }
    } catch (e) {
      log_error(e)
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async getSubTasks(task: IProjectTask) {
    let subTasks: IProjectTask[] = [];
    if (task?.id) {
      try {
        const config = this.getConf(task.id);
        const res = await this.api.getTaskGroups(config) as IServerResponse<IProjectTask[]>;
        if (res.done) subTasks = res.body;
      } catch (e) {
        // ignored
      }
    }
    return subTasks;
  }

  private mapTasks(groups: ITaskListGroup[]) {
    for (const group of groups) {
      this.map.registerGroup(group);
      for (const task of group.tasks) {
        if (task.start_date) task.start_date = new Date(task.start_date) as any;
        if (task.end_date) task.end_date = new Date(task.end_date) as any;
      }
    }
  }

  async toggleCollapse(groupId: string) {
    this.service.toggleGroupExpansion(groupId);
    this.cdr.detectChanges();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.service.emitRemoveIndicators(this.selectedTask?.id as string);
      this.selectedTask = null;
      this.cdr.markForCheck();
    }
  }

  protected openTask(task: IProjectTask) {
    this.selectedTask = null;
    this.selectedTask = task;
    this.showTaskModal = true;
    this.cdr.markForCheck()
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

  async initScrollHandler(needed: boolean) {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (this.fixed_right_column && needed) {
          this.fixed_right_column.nativeElement.scrollLeft = this.initialScroll - (2 * this.GANNT_COLUMN_WIDTH);
          this.scrollListner();
        }
      }, 100)
    });
    this.cdr.markForCheck();
  }

  afterViewScrollHandler(fromLeft: number) {
    this.ngZone.runOutsideAngular(() => {
      if (this.fixed_right_column) {
        this.fixed_right_column.nativeElement.classList.add('scroll-animation');
        this.fixed_right_column.nativeElement.scrollLeft = fromLeft - (2 * this.GANNT_COLUMN_WIDTH);
        setTimeout(() => {
          if (this.fixed_right_column) {
            this.fixed_right_column.nativeElement.classList.remove('scroll-animation');
          }
        }, 125);
      }
    });
    this.cdr.markForCheck();
  }

  protected async displaySubTasks(task: IProjectTask, groupId: string) {
    if (!task.id && task.sub_tasks_loading) return;
    if (!task.show_sub_tasks && task.sub_tasks_count === 0) {
      task.show_sub_tasks = true;
      task.sub_tasks = [];
      return;
    }
    task.sub_tasks_loading = true;
    task.show_sub_tasks = !task.show_sub_tasks;
    if (task.show_sub_tasks) {
      task.sub_tasks = await this.getSubTasks(task);
      for (const t of task.sub_tasks) {
        this.map.add(groupId, t);
      }
    } else {
      for (const t of task.sub_tasks || []) {
        this.map.deselectTask(t);
      }
      task.sub_tasks = [];
    }
    task.sub_tasks_loading = false;
    this.cdr.detectChanges();
  }

  deleteSubtask(task: ITaskViewTaskIds) {
    if (!task) return;

    const subtasks = this.map._subTasksMap.get(task.parent_task_id as string);
    if (!subtasks) return;

    const subtask = subtasks.find(t => t.id === task.id);
    if (!subtask) return;

    this.map.selectTask(subtask as IProjectTask);
    this.service.deleteTask(subtask.id as string);

    const task_: IProjectTask = {
      id: task.parent_task_id,
      project_id: task.project_id,
    }
    this.handleTaskSelectFromView(task_);

    this.cdr.detectChanges();
  }

  isVisible(el: HTMLDivElement) {
    if (!el) {
      return false;
    }
    return true;
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
}
