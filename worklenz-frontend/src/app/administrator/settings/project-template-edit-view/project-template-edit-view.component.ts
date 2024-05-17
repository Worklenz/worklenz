import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef, HostListener, NgZone, OnDestroy,
  OnInit,
  QueryList, Renderer2,
  ViewChildren
} from '@angular/core';
import {TaskListRowComponent} from "./task-list-row/task-list-row.component";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {PtTaskListService} from "./services/pt-task-list.service";
import {ActivatedRoute, Router} from "@angular/router";
import {PtTaskListHashMapService} from "./services/pt-task-list-hash-map.service";
import {Socket} from "ngx-socket-io";
import {UtilsService} from "@services/utils.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {IPTTask, IPTTaskListConfig, IPTTaskListGroup} from "./interfaces";
import {IGroupByOption, ITaskListGroupChangeResponse} from "../../modules/task-list-v2/interfaces";
import {CdkDragDrop, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {deepClone} from "@shared/utils";
import {AddTaskInputComponent} from "./components/add-task-input/add-task-input.component";
import {PtTasksApiService} from "@api/pt-tasks-api.service";
import {PtTaskPhasesApiService} from "@api/pt-task-phases-api.service";
import {PtLabelsApiService} from "@api/pt-labels-api.service";
import {PtStatusesApiService} from "@api/pt-statuses-api.service";
import {PtPrioritiesApiService} from "@api/pt-priorities-api.service";
import {SocketEvents} from "@shared/socket-events";
import {AppService} from "@services/app.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-project-template-edit-view',
  templateUrl: './project-template-edit-view.component.html',
  styleUrls: ['./project-template-edit-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectTemplateEditViewComponent implements OnInit, OnDestroy {
  @ViewChildren('row') rows!: QueryList<TaskListRowComponent>;
  @ViewChildren('scrollPanel') scrollPanels!: QueryList<ElementRef>;

  scrollBy = 0;

  protected templateId: string | null = null;
  templateName: string | null = '';
  protected searchValue: string | null = null;
  protected templatesFilterString: string | null = null;
  protected selected = false;
  protected loadingGroups = false;
  protected groupChanging = false;
  protected displayPhaseModal = false;
  protected displayStatusModal = false;
  protected checked = false;
  protected indeterminate = false;

  loadingFiltering = false;
  loadingStatuses = false;
  loadingPriorities = false;
  loadingCategories = false;
  loadingPhases = false;
  loadingLabels = false;

  protected taskId: string | null = null;

  protected selectedTask: IPTTask | null = null;
  protected groupIds: string[] = [];
  protected categories: ITaskStatusCategory[] = [];

  protected get loading() {
    return this.loadingGroups;
  }

  protected get defaultStatus() {
    return this.service.statuses.length
      ? this.service.statuses[0].id as string
      : null;
  }

  protected get groups() {
    return this.service.groups;
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly service: PtTaskListService,
    private readonly ngZone: NgZone,
    private readonly map: PtTaskListHashMapService,
    private readonly socket: Socket,
    private readonly renderer: Renderer2,
    public readonly utils: UtilsService,
    private readonly api: PtTasksApiService,
    private readonly labelsApi: PtLabelsApiService,
    private readonly statusesApi: PtStatusesApiService,
    private readonly prioritiesApi: PtPrioritiesApiService,
    private readonly phasesApi: PtTaskPhasesApiService,
    private app: AppService,
    private readonly auth: AuthService,
  ) {
    this.templateId = this.route.snapshot.paramMap.get("id");
    this.templateName = this.route.snapshot.paramMap.get("name");
    this.app.setTitle("Edit Template");

    this.service.settemplateId(this.templateId as string);
    this.service.onTaskAddOrDelete$
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.cdr.markForCheck();
      });
    this.service.onRefresh$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.cdr.markForCheck();
      });
    this.service.onRefreshSubtasksIncluded
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.cdr.markForCheck();
      });

  }

  ngOnInit() {
    this.service.isSubtasksIncluded = false;
    this.init(true);
  }

  init(loading: boolean) {
    void Promise.all([
      this.getGroups(loading),
      // this.getColumns(),
      this.getLabels(),
      this.getStatuses(),
      this.getPriorities(),
      this.getCategories(),
      this.getPhases(),
    ]);
    this.socket.on(SocketEvents.PT_TASK_SORT_ORDER_CHANGE.toString(), this.handleSortOrderResponse);
  }

  ngOnDestroy() {
    this.ngZone.runOutsideAngular(() => {
      this.service.reset();
      this.service.groups = [];
      this.map.reset();
    });
    this.socket.removeListener(SocketEvents.PT_TASK_SORT_ORDER_CHANGE.toString(), this.handleSortOrderResponse);
  }

  protected isGroupByPhase() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_PHASE_VALUE;
  }

  private getConf(parentTaskId?: string): IPTTaskListConfig {
    const config: IPTTaskListConfig = {
      id: this.templateId as string,
      search: this.searchValue,
      projects: this.templatesFilterString,
      group: this.service.getCurrentGroup().value,
      isSubtasksInclude: false
    };

    if (parentTaskId)
      config.parent_task = parentTaskId;

    return config;
  }

  protected async displaySubTasks(task: IPTTask, row: TaskListRowComponent, groupId: string) {
    if (!task.id && task.sub_tasks_loading) return;

    // Ignore loading sub-tasks from api when we know it's empty
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

    row.detectChanges();
    this.cdr.markForCheck();
  }

  protected toggleGroup(event: MouseEvent, panel: HTMLDivElement) {
    this.ngZone.runOutsideAngular(() => {
      const target = event.target as Element;
      if (!target) return;
      target.closest('.btn')?.classList.toggle("active");
      const maxHeight = panel.style.maxHeight === "0px" ? panel.scrollHeight + 8 + 'px' : "0px";
      this.renderer.setStyle(panel, "max-height", maxHeight);
    });
  }

  protected trackById(index: number, item: IPTTask | IPTTaskListGroup) {
    return item.id;
  }

  protected onDrop(event: CdkDragDrop<IPTTaskListGroup, IPTTaskListGroup, IPTTask>) {
    const fromIndex = event.previousIndex;
    const toIndex = event.currentIndex;

    const fromGroup = event.previousContainer.data;
    const toGroup = event.container.data;

    // collapse button icon rotate
    if (fromGroup.tasks.length == 0) {
      this.ngZone.runOutsideAngular(() => {
        const buttonElement = document.getElementById(`${event.previousContainer.id}`)?.closest("div")?.parentNode?.parentNode?.parentNode?.querySelector("button.collapse.active");
        buttonElement?.classList.remove('active');
      });
    }
    const task = event.item.data;
    const toPos = toGroup.tasks[toIndex]?.sort_order;

    this.socket.emit(SocketEvents.PT_TASK_SORT_ORDER_CHANGE.toString(), {
      template_id: this.service.gettemplateId(),
      from_index: fromGroup.tasks[fromIndex].sort_order,
      to_index: toPos || toGroup.tasks[toGroup.tasks.length - 1]?.sort_order || -1,
      to_last_index: !toPos,
      from_group: fromGroup.id,
      to_group: toGroup.id,
      group_by: this.service.getCurrentGroup().value,
      task,
      team_id: this.auth.getCurrentSession()?.team_id
    });

    if (fromGroup.id === toGroup.id) { // same group
      moveItemInArray(event.container.data.tasks, fromIndex, toIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data.tasks,
        event.container.data.tasks,
        event.previousIndex,
        event.currentIndex
      );

      this.map.remove(task);
      this.map.add(toGroup.id, task);

      this.service.emitGroupChange(toGroup.id, task.id as string, toGroup.color_code);
    }
  }

  protected async bulkUpdateSuccess() {
    await this.getGroups(true);
  }

  protected selectTasksInGroup(checked: boolean, group: IPTTaskListGroup) {
    for (const task of group.tasks) {
      if (checked) {
        this.map.selectTask(task);
      } else {
        this.map.deselectTask(task);
      }
    }
  }

  private mapTasks(groups: IPTTaskListGroup[]) {
    for (const group of groups) {
      this.map.registerGroup(group);
      for (const task of group.tasks) {
        if (task.start_date) task.start_date = new Date(task.start_date) as any;
        if (task.end_date) task.end_date = new Date(task.end_date) as any;
      }
    }
  }

  private toggleFocusCls(focused: boolean, element: HTMLElement) {
    if (focused) {
      this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
    } else {
      this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
    }
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.selectedTask = null;
    }
  }

  private handleNewTaskReceive(value: ITaskListGroupChangeResponse) {
    if (value.isSubTask) {
      const row = this.rows
        .find(r => r.id === value.taskId);
      if (row) {
        row.detectChanges();
      }
    }
    this.cdr.markForCheck();
  }

  private handleSortOrderResponse = (tasks: IPTTask[]) => {
    for (const element of tasks) {
      const taskId = element.id;
      if (taskId) {
        const task = this.map.tasks.get(taskId);
        if (task) {
          task.sort_order = element.sort_order;
          this.map.tasks.set(taskId, task);
        }
      }
    }
  };

  protected handleFocusChange(focused: boolean, element: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      this.toggleFocusCls(focused, element);
    });
  }

  protected quickTaskFocusChange(focused: boolean, td: HTMLElement, _ref: AddTaskInputComponent) {
    this.ngZone.runOutsideAngular(() => {
      this.toggleFocusCls(focused, td);
    });
  }

  protected async onGroupByChange(group: IGroupByOption) {
    this.service.setCurrentGroup(group);
    this.groupChanging = true;
    await this.getGroups(true);
    setTimeout(() => {
      this.groupChanging = false;
      this.cdr.markForCheck();
    }, 100); // wait for animations to be finished
  }

  async handleFilterSearch(searchText: string | null) {
    this.loadingFiltering = true;
    this.searchValue = searchText;
    await this.getGroups(true);
    this.loadingFiltering = false;
    this.cdr.markForCheck();
  }

  private async getGroups(loading: boolean) {
    if (!this.templateId) return;
    try {
      this.map.deselectAll();
      this.loadingGroups = loading;
      const config = this.getConf();
      config.isSubtasksInclude = this.service.isSubtasksIncluded;
      const res = await this.api.getTaskList(config) as IServerResponse<IPTTaskListGroup[]>;
      if (res.done) {
        const groups = deepClone(res.body);
        this.groupIds = groups.map((g: IPTTaskListGroup) => g.id);
        this.mapTasks(groups);
        this.service.groups = groups;
      }
      this.loadingGroups = false;
    } catch (e) {
      this.loadingGroups = false;
    }
    this.cdr.markForCheck();
  }

  private async getSubTasks(task: IPTTask) {
    let subTasks: IPTTask[] = [];
    if (task?.id) {
      try {
        const config = this.getConf(task.id);
        const res = await this.api.getTaskList(config) as IServerResponse<IPTTask[]>;
        if (res.done) subTasks = res.body;
      } catch (e) {
        // ignored
      }
    }
    return subTasks;
  }

  private async getStatuses() {
    if (!this.templateId) return;
    try {
      this.loadingStatuses = true;
      const res = await this.statusesApi.get(this.templateId);
      if (res.done)
        this.service.statuses = res.body;
      this.loadingStatuses = false;
    } catch (e) {
      this.loadingStatuses = false;
    }
  }

  private async getPriorities() {
    try {
      this.loadingPriorities = true;
      const res = await this.prioritiesApi.get();
      if (res.done)
        this.service.priorities = res.body;
      this.loadingPriorities = false;
    } catch (e) {
      this.loadingPriorities = false;
    }
  }

  private async getCategories() {
    try {
      this.loadingCategories = true;
      const res = await this.statusesApi.getCategories();
      if (res.done)
        this.categories = res.body;
      this.loadingCategories = false;
    } catch (e) {
      this.loadingCategories = false;
    }
  }

  private async getPhases() {
    if (!this.templateId) return;
    try {
      this.loadingPhases = true;
      const res = await this.phasesApi.get(this.templateId);
      if (res.done)
        this.service.phases = res.body;
      this.loadingPhases = false;
    } catch (e) {
      this.loadingPhases = false;
    }
  }

  protected async getLabels() {
    try {
      this.loadingLabels = true;
      const res = await this.labelsApi.get(this.templateId);
      if (res.done)
        this.service.labels = res.body;
      this.loadingLabels = false;
    } catch (e) {
      this.loadingLabels = false;
    }
  }

  @HostListener('scroll', ['$event.target'])
  onScroll(target: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      const cls = 'scrolling-panel';
      this.scrollBy = target.scrollLeft;
      if (this.scrollBy > 0) {
        target.classList.add(cls)
      } else {
        target.classList.remove(cls)
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  debounce(func: Function, delay: number) {
    let timeoutId: any;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  openAddColumnDrawer() {
    this.displayPhaseModal = true;
  }

  openStatusDrawer() {
    this.displayStatusModal = true;
  }

  onBack() {
    this.router.navigate([`/worklenz/settings/project-templates`]);
  }

  refreshWithoutLoading() {
    this.init(false);
  }

}
