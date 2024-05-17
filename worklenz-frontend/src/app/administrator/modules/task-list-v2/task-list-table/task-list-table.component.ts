import {CdkDragDrop, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  Renderer2,
  ViewChildren
} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {TaskLabelsApiService} from "@api/task-labels-api.service";
import {TaskPrioritiesService} from "@api/task-priorities.service";
import {TaskStatusesApiService} from "@api/task-statuses-api.service";
import {TasksApiService} from "@api/tasks-api.service";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {UtilsService} from "@services/utils.service";
import {Socket} from "ngx-socket-io";
import {filter, merge} from "rxjs";
import {
  IGroupByOption,
  IMembersFilterChange,
  ITaskListConfigV2,
  ITaskListGroup,
  ITaskListGroupChangeResponse
} from "../interfaces";
import {TaskListHashMapService} from "../task-list-hash-map.service";
import {TaskListV2Service} from "../task-list-v2.service";
import {TaskListAddTaskInputComponent} from "./task-list-add-task-input/task-list-add-task-input.component";
import {TaskListRowComponent} from "./task-list-row/task-list-row.component";
import {TaskTemplatesService} from "@api/task-templates.service";
import {SocketEvents} from "@shared/socket-events";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {KanbanV2Service} from "../../kanban-view-v2/kanban-view-v2.service";
import {deepClone, waitForSeconds} from "@shared/utils";
import {TaskPhasesApiService} from "@api/task-phases-api.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ProjectPhasesService} from "@services/project-phases.service";
import {Promise} from "@rx-angular/cdk/zone-less/browser";
import {ProjectFormService} from "@services/project-form-service.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-list-table',
  templateUrl: './task-list-table.component.html',
  styleUrls: ['./task-list-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListTableComponent implements OnInit, OnDestroy {
  @ViewChildren('row') rows!: QueryList<TaskListRowComponent>;
  @ViewChildren('scrollPanel') scrollPanels!: QueryList<ElementRef>;

  protected projectId: string | null = null;
  protected sortField: string | null = null;
  protected sortOrder: string | null = null;
  protected searchValue: string | null = null;
  protected statusesFilterString: string | null = null;
  protected membersFilterString: string | null = null;
  protected projectsFilterString: string | null = null;
  protected labelsFilterString: string | null = null;
  protected priorityFilterString: string | null = null;

  scrollBy = 0;

  protected showArchived = false;
  protected selected = false;
  protected loadingGroups = false;
  protected loadingMembers = false;
  protected loadingColumns = false;
  protected loadingLabels = false;
  protected loadingStatuses = false;
  protected loadingPriorities = false;
  protected loadingPhases = false;
  protected loadingCategories = false;
  protected showTaskModal = false;
  protected showTaskTemplatesDrawer = false;
  protected loadingArchived = false;
  protected loadingFiltering = false;
  protected groupChanging = false;
  protected displayPhaseModal = false;

  // Select all
  protected checked = false;
  protected indeterminate = false;
  showStatusModal = false;
  isScrolled = false;

  protected taskId: string | null = null;

  protected selectedTask: IProjectTask | null = null;
  protected groupIds: string[] = [];
  protected categories: ITaskStatusCategory[] = [];

  private scrolling = false;

  protected get loading() {
    return this.loadingColumns || this.loadingGroups || this.loadingFiltering || this.groupChanging;
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
    private readonly api: TasksApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly tmApi: TeamMembersApiService,
    private readonly labelsApi: TaskLabelsApiService,
    private readonly statusesApi: TaskStatusesApiService,
    private readonly prioritiesApi: TaskPrioritiesService,
    private readonly phasesApi: TaskPhasesApiService,
    private readonly ngZone: NgZone,
    private readonly map: TaskListHashMapService,
    private readonly socket: Socket,
    private readonly renderer: Renderer2,
    private readonly taskTemplates: TaskTemplatesService,
    private readonly view: TaskViewService,
    private readonly kanbanService: KanbanV2Service,
    private readonly phaseService: ProjectPhasesService,
    public readonly service: TaskListV2Service,
    public readonly utils: UtilsService,
    private readonly projectFormService: ProjectFormService,
    private readonly auth: AuthService,
  ) {
    // The id parameter represents the project id
    this.projectId = this.route.snapshot.paramMap.get("id");
    this.taskId = this.route.snapshot.queryParamMap.get("task");

    // set group parameter to the from reporting and check them
    this.route.queryParams.subscribe(params => {
      const typeParam = params['group'];
      if (typeParam) {
        switch (typeParam) {
          case "status":
            this.service.setCurrentGroup(this.service.GROUP_BY_OPTIONS[0]);
            break;
          case "priority":
            this.service.setCurrentGroup(this.service.GROUP_BY_OPTIONS[1]);
            break;
          case "phase":
            this.service.setCurrentGroup(this.service.GROUP_BY_OPTIONS[2]);
            break;
          default :
            this.service.setCurrentGroup(this.service.GROUP_BY_OPTIONS[0]);
            break;
        }
      }
    });

    this.service.setProjectId(this.projectId as string);

    this.service.onTaskAddOrDelete$
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        if (value)
          this.handleNewTaskReceive(value);
      });

    this.taskTemplates.onTemplateImport
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.getGroups(true);
      });

    this.service.onRefresh$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.getGroups(false);
      });

    this.service.onRefreshSubtasksIncluded
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.getGroups(false);
      });

    this.view.onSelectTask
      .pipe(takeUntilDestroyed())
      .subscribe((taskId: string) => {
        const task = this.map.tasks.get(taskId);
        if (task) {
          void this.handleTaskSelectFromView(task);
        }
      });
    //
    // this.view.onSelectSubTask
    //   .pipe(takeUntilDestroyed())
    //   .subscribe((task: IProjectTask) => {
    //     if (task) {
    //       void this.handleTaskSelectFromView(task);
    //     }
    //   });

    merge(this.phaseService.onPhaseOptionsChange, this.view.onPhaseChange)
      .pipe(
        filter(() => this.service.getCurrentGroup().value === this.service.GROUP_BY_PHASE_VALUE),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        void this.getGroups(false);
      });

    this.projectFormService.onMemberAssignOrRemoveReProject
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.cdr.markForCheck();
        this.getTeamMembers();
      })
  }

  ngOnInit(): void {
    this.service.isSubtasksIncluded = false;
    void Promise.all([
      this.getGroups(true),
      this.getColumns(),
      this.getTeamMembers(),
      this.getLabels(),
      this.getStatuses(),
      this.getPriorities(),
      this.getCategories(),
      this.getPhases(),
    ]);

    this.socket.on(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), this.handleSortOrderResponse);

    if (this.taskId && this.projectId) {
      this.openTask({
        id: this.taskId,
        project_id: this.projectId
      });
    }
  }

  ngOnDestroy() {
    this.ngZone.runOutsideAngular(() => {
      this.service.reset();
      this.service.groups = [];
      this.map.reset();
    });

    this.socket.removeListener(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), this.handleSortOrderResponse);
  }

  protected isGroupByPhase() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_PHASE_VALUE;
  }

  /** @param parentTaskId if provided, the list considers as sub-tasks of the given parentTaskId */
  private getConf(parentTaskId?: string): ITaskListConfigV2 {
    const config: ITaskListConfigV2 = {
      id: this.projectId as string,
      field: this.sortField,
      order: this.sortOrder,
      search: this.searchValue,
      statuses: this.statusesFilterString,
      members: this.membersFilterString,
      projects: this.projectsFilterString,
      priorities: this.priorityFilterString,
      labels: this.labelsFilterString,
      archived: this.showArchived,
      group: this.service.getCurrentGroup().value,
      isSubtasksInclude: false
    };

    if (parentTaskId)
      config.parent_task = parentTaskId;

    return config;
  }

  protected async displaySubTasks(task: IProjectTask, row: TaskListRowComponent, groupId: string) {
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

  protected trackById(index: number, item: IProjectTask | ITaskListGroup) {
    return item.id;
  }

  protected onDrop(event: CdkDragDrop<ITaskListGroup, ITaskListGroup, IProjectTask>) {
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

    this.socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
      project_id: this.service.getProjectId(),
      from_index: fromGroup.tasks[fromIndex].sort_order,
      to_index: toPos || toGroup.tasks[toGroup.tasks.length - 1]?.sort_order || -1,
      to_last_index: !toPos,
      from_group: fromGroup.id,
      to_group: toGroup.id,
      group_by: this.service.getCurrentGroup().value,
      task,
      team_id: this.auth.getCurrentSession()?.team_id
    });

    this.socket.once(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), () => {
      this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
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

    this.kanbanService.emitRefreshGroups();
  }

  protected openTask(task: IProjectTask) {
    this.selectedTask = task;
    this.showTaskModal = true;
    this.cdr.markForCheck();
  }

  protected async bulkUpdateSuccess() {
    await this.getGroups(true);
  }

  protected async onStatusCreateOrUpdate() {
    await this.getStatuses();
    await this.getGroups(false);
  }

  protected toggleTaskTemplateDrawer(event: any) {
    this.showTaskTemplatesDrawer = true;
  }

  protected onTaskTemplateCreate() {
    this.showTaskTemplatesDrawer = false;
    this.map.deselectAll();
  }

  protected taskTemplateCancel(event: any) {
    this.showTaskTemplatesDrawer = event;
  }

  protected selectTasksInGroup(checked: boolean, group: ITaskListGroup) {
    for (const task of group.tasks) {
      if (checked) {
        this.map.selectTask(task);
      } else {
        this.map.deselectTask(task);
      }
    }
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

  private handleSortOrderResponse = (tasks: IProjectTask[]) => {
    for (const element of tasks) {
      const taskId = element.id;
      if (taskId) {
        const task = this.map.tasks.get(taskId);
        if (task) {
          task.sort_order = element.sort_order;
          task.completed_at = element.completed_at;
          this.map.tasks.set(taskId, task);
        }
      }
    }
  };

  private closeTask() {
    this.showTaskModal = false;
    this.selectedTask = null;
    this.cdr.detectChanges();
  }

  private async handleTaskSelectFromView(task: IProjectTask) {
    this.closeTask();
    if (task) {
      await waitForSeconds();
      this.openTask(task);
    }
  }

  protected handleFocusChange(focused: boolean, element: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      this.toggleFocusCls(focused, element);
    });
  }

  protected quickTaskFocusChange(focused: boolean, td: HTMLElement, _ref: TaskListAddTaskInputComponent) {
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

  protected async onArchiveChange() {
    this.loadingGroups = true;
    this.loadingArchived = true;
    this.service.groups = [];

    await this.getGroups(true);
    this.loadingArchived = false;
    this.cdr.markForCheck();
  }

  async handleFilterByMember(filterBody: IMembersFilterChange) {
    this.loadingFiltering = true;
    this.membersFilterString = filterBody.selection;

    if (filterBody.is_subtasks_included) {
      this.service.isSubtasksIncluded = true;
    } else {
      this.service.isSubtasksIncluded = false;
    }

    await this.getGroups(true);
    this.loadingFiltering = false;
    this.cdr.markForCheck();
  }

  async handleFilterByLabel(filterString: string) {
    this.loadingFiltering = true;
    this.labelsFilterString = filterString;
    await this.getGroups(true);
    this.loadingFiltering = false;
    this.cdr.markForCheck();
  }

  async handleFilterByPriority(filterString: string) {
    this.loadingFiltering = true;
    this.priorityFilterString = filterString;
    await this.getGroups(true);
    this.loadingFiltering = false;
    this.cdr.markForCheck();
  }

  async handleFilterSortBy(filterString: string) {
    this.loadingFiltering = true;
    this.sortField = filterString;
    await this.getGroups(true);
    this.loadingFiltering = false;
    this.cdr.markForCheck();
  }

  async handleFilterSearch(searchText: string | null) {
    this.loadingFiltering = true;
    this.searchValue = searchText;
    await this.getGroups(true);
    this.loadingFiltering = false;
    this.cdr.markForCheck();
  }

  /// API Calls
  private async getGroups(loading = true) {
    if (!this.projectId) return;
    try {
      this.map.deselectAll();
      this.loadingGroups = loading;
      const config = this.getConf();
      config.isSubtasksInclude = this.service.isSubtasksIncluded;
      const res = await this.api.getTaskListV2(config) as IServerResponse<ITaskListGroup[]>;
      if (res.done) {
        const groups = deepClone(res.body);
        this.groupIds = groups.map((g: ITaskListGroup) => g.id);
        this.mapTasks(groups);
        this.service.groups = groups;
      }
      this.loadingGroups = false;
    } catch (e) {
      this.loadingGroups = false;
    }

    this.cdr.markForCheck();
  }

  private async getSubTasks(task: IProjectTask) {
    let subTasks: IProjectTask[] = [];
    if (task?.id) {
      try {
        const config = this.getConf(task.id);
        const res = await this.api.getTaskListV2(config) as IServerResponse<IProjectTask[]>;
        if (res.done) subTasks = res.body;
      } catch (e) {
        // ignored
      }
    }
    return subTasks;
  }

  private async getColumns() {
    if (!this.projectId) return;
    try {
      this.loadingColumns = true;
      const res = await this.api.getListCols(this.projectId);
      if (res.done)
        this.service.columns = res.body;
      this.loadingColumns = false;
    } catch (e) {
      this.loadingColumns = false;
    }
  }

  private async getTeamMembers() {
    try {
      this.loadingMembers = true;
      const res = await this.tmApi.getAll(this.projectId);
      if (res.done)
        this.service.members = res.body;
      this.loadingMembers = false;
    } catch (e) {
      this.loadingMembers = false;
    }
  }

  protected async getLabels() {
    try {
      this.loadingLabels = true;
      const res = await this.labelsApi.get(this.projectId);
      if (res.done)
        this.service.labels = res.body;
      this.loadingLabels = false;
    } catch (e) {
      this.loadingLabels = false;
    }
  }

  private async getStatuses() {
    if (!this.projectId) return;
    try {
      this.loadingStatuses = true;
      const res = await this.statusesApi.get(this.projectId);
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
    if (!this.projectId) return;
    try {
      this.loadingPhases = true;
      const res = await this.phasesApi.get(this.projectId);
      if (res.done)
        this.service.phases = res.body;
      this.loadingPhases = false;
    } catch (e) {
      this.loadingPhases = false;
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

  openStatusSettingsDrawer() {
    this.showStatusModal = true;
  }

  public async refreshWithoutLoad() {
    await this.getGroups(false);
  }

}
