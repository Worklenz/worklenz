import {CdkDragDrop, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TaskStatusesApiService} from '@api/task-statuses-api.service';
import {TasksApiService} from '@api/tasks-api.service';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';
import {ITaskCreateRequest} from '@interfaces/api-models/task-create-request';
import {ITaskStatusViewModel} from '@interfaces/api-models/task-status-get-response';
import {ISubTask} from '@interfaces/sub-task';
import {ITask} from '@interfaces/task';
import {ITaskStatusCategory} from '@interfaces/task-status-category';
import {AuthService} from '@services/auth.service';
import {EventStatusChanged, EventTaskCreatedOrUpdate} from '@shared/events';
import {SocketEvents} from '@shared/socket-events';
import {formatGanttDate, log_error} from '@shared/utils';
import {NzContextMenuService, NzDropdownMenuComponent} from 'ng-zorro-antd/dropdown';
import {Socket} from 'ngx-socket-io';
import {merge} from 'rxjs';
import {TaskListHashMapService} from '../../task-list-v2/task-list-hash-map.service';
import {TaskListV2Service} from '../../task-list-v2/task-list-v2.service';
import {Board} from './models/board.model';
import {ILocalSession} from '@interfaces/api-models/local-session';
import {DEFAULT_TASK_NAME, DRAWER_ANIMATION_INTERVAL} from "@shared/constants";
import {KanbanV2Service} from '../kanban-view-v2.service';
import {
  IGroupByOption,
  ITaskListConfigV2,
  ITaskListGroup,
  ITaskListGroupChangeResponse
} from '../../task-list-v2/interfaces';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {IKanbanTaskStatus} from '@interfaces/task-status';
import {IBulkAssignRequest} from '@interfaces/api-models/bulk-assign-request';
import {TaskViewService} from '@admin/components/task-view/task-view.service';
import moment from 'moment';
import {ITaskAssigneesUpdateResponse} from '@interfaces/task-assignee-update-response';
import {TeamMembersApiService} from '@api/team-members-api.service';
import {TaskLabelsApiService} from '@api/task-labels-api.service';
import {TaskPrioritiesService} from '@api/task-priorities.service';
import {TaskTemplatesService} from '@api/task-templates.service';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ITaskListStatusChangeResponse} from "@interfaces/task-list-status-change-response";
import {ProjectsService} from "../../../projects/projects.service";

@Component({
  selector: 'worklenz-kanban-board',
  templateUrl: './kanban-board.component.html',
  styleUrls: ['./kanban-board.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanBoardComponent implements OnInit, OnDestroy {

  private session: ILocalSession | null = null;

  @ViewChild('inputValue') inputValue!: ElementRef;
  @ViewChild('tasksContainer', {static: false}) tasksContainer!: ElementRef;
  @ViewChild('taskCreateCard', {static: false}) taskCreateCard!: ElementRef;

  public board: Board = new Board([]);
  taskStatuses: ITaskStatusViewModel[] = [];
  loaders: { [x: string]: boolean } = {};

  projectId: string | null = null;

  tasks: {
    [x: number]: {
      id?: string;
      label?: string;
      data?: IProjectTask[];
    }
  } = {};
  statusIds: string[] = [];
  categories: ITaskStatusCategory[] = [];

  loadingStatuses = false;
  showTaskModal = false;
  updateLoading = false;
  showStatusModal = false;
  loadingTasks = false;
  loadingSubTasks = false;
  taskDragging = false;
  isEditColProgress = false;
  loadingCategories = false;
  assigningTasks = false;
  archivingTasks = false;
  deletingTasks = false;
  showStatusesReplaceModal = false;
  deletingStatus = false;
  taskUpdated = false;
  creatingTask = false;
  updatingTask = false;
  isCreateButtonClicked = false
  loadingGroups = false;
  loadingMembers = false;
  loadingLabels = false;
  loadingPriorities = false;

  selectedTaskId: string | null = null;
  selectedStatusId: string | null = null;
  statusDeleteWarning: string | null = null;
  newTaskName?: string | null = null;
  createdTaskId?: string | null = null;
  createTaskEndDate: string | null = null;
  previousColumnName: string | null = null;

  editingColumn: ITaskListGroup | null = null;
  selectedForDelete: ITaskListGroup | null = null;
  createdTask: IProjectTask | null = null

  subTasks: ISubTask[] = [];
  createdMainTask: IProjectTask | null = null
  taskStatuses_: string[] = [];
  contextSelectedTask: IProjectTask | null = null;
  replacingStatus: string | null = null;
  selectedTask: ITask | null = null;

  statusesColumns: { [columnId: string]: boolean } = {};
  createButtons: { [columnId: string]: boolean } = {};

  tasksContainerMain: HTMLDivElement | null = null;
  selectedGroupFilter: IGroupByOption | null = null;

  get defaultStatus() {
    return this.taskStatuses[0] || null;
  }

  get profile() {
    return this.auth.getCurrentSession();
  }

  protected get groups() {
    return this.service.groups;
  }

  constructor(
    private readonly api: TasksApiService,
    private readonly auth: AuthService,
    private readonly statusesApi: TaskStatusesApiService,
    private readonly route: ActivatedRoute,
    private readonly contextMenuService: NzContextMenuService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly socket: Socket,
    private readonly map: TaskListHashMapService,
    private readonly view: TaskViewService,
    private readonly tmApi: TeamMembersApiService,
    private readonly labelsApi: TaskLabelsApiService,
    private readonly prioritiesApi: TaskPrioritiesService,
    private readonly taskTemplates: TaskTemplatesService,
    public readonly kanbanService: KanbanV2Service,
    public readonly service: TaskListV2Service,
    private readonly projectsService: ProjectsService
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id');

    this.taskTemplates.onTemplateImport.pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.getGroups();
      });

    merge(this.view.onSelectTask, this.view.onSelectSubTask)
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        if (typeof value === "string") {
          const task = this.map.tasks.get(value);
          if (task)
            this.handleTaskSelectFromView(task);
        } else {
          this.handleTaskSelectFromView(value);
        }
      });

    this.kanbanService.onCreateStatus
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.onStatusCreate(value);
      });

    this.service.onTaskAddOrDelete$
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        if (value)
          this.handleNewTaskReceive(value);
      });

    this.kanbanService.onCreateSubTask
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.onSubtaskCreate(value);
      });

    this.kanbanService.onAssignMembers
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.handleNewTaskAssignees(value)
      });

    this.kanbanService.onDeleteTask
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.service.deleteTask(value.id as string);
        this.cdr.markForCheck();
      });
  }

  ngOnInit(): void {
    void this.init();
    this.socket.on(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), this.handleSortOrderResponse);
    this.socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), this.handleStatusChangeResponse);
    this.session = this.auth.getCurrentSession();
    this.selectedGroupFilter = this.service.getCurrentGroup();
    this.service.setCurrentGroup(this.service.GROUP_BY_OPTIONS[0]);
  }

  private async init() {
    void this.getGroups();
    void this.getCategories();
    void this.getStatuses();
    void this.getTeamMembers();
    void this.getLabels();
    void this.getPriorities();
  }

  ngOnDestroy(): void {
    this.board.columns = [];
    this.tasks = {};
    this.statusIds = [];
    this.loaders = {};
    this.socket.removeListener(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), this.handleSortOrderResponse);
    if (this.selectedGroupFilter) this.service.setCurrentGroup(this.selectedGroupFilter);
  }

  isProjectManager() {
    if (this.projectsService.projectOwnerTeamMemberId) return this.auth.getCurrentSession()?.team_member_id === this.projectsService.projectOwnerTeamMemberId;
    return false;
  }

  private handleNewTaskReceive(value: ITaskListGroupChangeResponse) {
    if (value.isSubTask) {
      this.cdr.detectChanges();
    }
    this.cdr.markForCheck();
  }

  private onSubtaskCreate(task: IProjectTask) {
    if (task) {
      const group = this.service.groups.find(g => g.id === task.status);
      if (group) {
        group.tasks.push(task)
      }
    }
    this.cdr.markForCheck();
  }

  private getConf(parentTaskId?: string): ITaskListConfigV2 {

    const config: ITaskListConfigV2 = {
      id: this.projectId as string,
      statuses: null,
      group: this.service.GROUP_BY_STATUS_VALUE,
      field: null,
      order: null,
      search: null,
      members: null,
      projects: null,
      isSubtasksInclude: true
    };

    if (parentTaskId)
      config.parent_task = parentTaskId;

    return config;
  }

  private async getGroups() {
    if (!this.projectId) return;
    try {
      this.map.deselectAll();
      this.loadingGroups = true;
      const config = this.getConf();
      const res = await this.api.getTaskListV2(config) as IServerResponse<ITaskListGroup[]>;
      if (res.done) {
        this.service.groups = res.body;
        this.groupIds = res.body.map(g => g.id);
        this.mapTasks(this.service.groups);
      }
    } catch (e) {
      this.loadingGroups = false;
    }

    this.cdr.detectChanges();
  }

  private mapTasks(groups: ITaskListGroup[]) {
    for (const group of groups) {
      this.map.registerGroup(group);
      for (const task of group.tasks) {
        if (task.start_date) task.start_date = new Date(task.start_date) as any;
        if (task.end_date) task.end_date = new Date(task.end_date) as any;
      }
    }
    this.loadingGroups = false;
  }

  protected trackById(index: number, item: IProjectTask | ITaskListGroup) {
    return item.id;
  }

  private onStatusCreate(status: IKanbanTaskStatus) {
    const newStatus: ITaskListGroup = {
      id: status.id as string,
      name: status.name as string,
      color_code: status.color_code as string,
      category_id: status.category_id as string,
      tasks: [],
    }
    this.service.groups.push(newStatus);
    if (status.id) this.groupIds.push(status.id);
    // this.getGroups();
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event.target'])
  onClick(target: HTMLElement) {
    if (this.taskCreateCard && !this.taskCreateCard.nativeElement.contains(target) && (!this.newTaskName || this.newTaskName.trim() === "")) {
      this.deleteTask();
      this.resetAll();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.newTaskName) {
      this.deleteTask();
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

  private handleStatusChangeResponse = (response: ITaskListStatusChangeResponse) => {
    if (response && response.id) {

      const groupId = this.map.getGroupId(response.id);
      if (!groupId || !response.id) return;

      const group = this.service.groups.find(g => g.id === groupId);
      if (!group) return;

      const task = group.tasks.find(t => t.id === response.id);
      if (!task) return;

      task.status = response.status_id;

      if (this.isGroupByStatus()) {

        this.service.updateTaskGroup(task, false);

        if (task.parent_task_id) {

          const groupId = this.service.getGroupIdByGroupedColumn(task);
          const group_ = this.groups.find(g => g.id === groupId);

          if (!group_) return;
          group_.tasks.push(task);

        }

      }

      this.cdr.markForCheck();
    }
  }

  private isGroupByStatus() {
    return this.service.getCurrentGroup().value === this.service.GROUP_BY_STATUS_VALUE;
  }

  isOwnerOrAdmin() {
    return this.profile?.owner || this.profile?.is_admin;
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.selectedTask = null;
    }
  }

  handleSortOrderResponse = (updatedTasks: IProjectTask[]) => {
    for (const element of updatedTasks) {
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

  async editModal(task: IProjectTask, event?: Event) {
    if (task && task.id && !this.taskDragging) {
      this.selectedTask = task;
      this.selectedTaskId = task.id;
      this.showTaskModal = true;
    }
    event?.preventDefault();
  }

  private handleTaskSelectFromView(task: IProjectTask) {
    this.showTaskModal = false;
    this.cdr.detectChanges();

    setTimeout(() => {
      if (task) {
        this.editModal(task);
        this.cdr.markForCheck();
      }
    }, DRAWER_ANIMATION_INTERVAL);
  }

  drop(event: CdkDragDrop<ITaskListGroup, ITaskListGroup, IProjectTask>) {

    if (this.projectId) {

      const fromIndex = event.previousIndex;
      const toIndex = event.currentIndex;
      const fromGroup = event.previousContainer.data;
      const toGroup = event.container.data;
      const task = event.item.data;
      const toPos = toGroup.tasks[toIndex]?.sort_order;

      const body = {
        project_id: this.projectId,
        from_index: fromGroup.tasks[fromIndex].sort_order,
        to_index: toPos || toGroup.tasks[toGroup.tasks.length - 1]?.sort_order || -1,
        to_last_index: !toPos,
        from_group: fromGroup.id,
        to_group: toGroup.id,
        group_by: this.service.GROUP_BY_STATUS_VALUE,
        task,
        team_id: this.auth.getCurrentSession()?.team_id
      };

      this.socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), body);

      this.socket.once(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), () => {
        if (task.is_sub_task) {
          this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
        } else {
          this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
        }
      });

      if (fromGroup.id === toGroup.id) {
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
      this.cdr.markForCheck();
    }
  }

  async dropGrid(event: any) {
    moveItemInArray(this.service.groups, event.previousIndex, event.currentIndex);

    const columnOrder: string[] = [];
    for (const element of this.service.groups)
      columnOrder.push(element.id);

    const res = await this.statusesApi.updateStatus(event.item.data || '', {status_order: columnOrder}, this.projectId as string);
    if (!res.done) {
      moveItemInArray(this.service.groups, event.currentIndex, event.previousIndex);
    }
  }

  protected groupIds: string[] = [];

  async getStatuses() {
    if (!this.projectId) return;
    try {
      this.loadingStatuses = !this.taskUpdated;

      const res = await this.statusesApi.get(this.projectId);
      if (res.done) {
        this.taskStatuses = res.body;
        // await this.getGroupedTasks();
      }
      this.loadingStatuses = false;
    } catch (e) {
      log_error(e);
      this.loadingStatuses = false;
    }

    this.cdr.markForCheck();
  }

  async getCategories() {
    try {
      this.loadingCategories = true;
      const res = await this.statusesApi.getCategories();
      if (res.done) {
        this.categories = res.body;
      }
      this.loadingCategories = false;
    } catch (e) {
      log_error(e);
      this.loadingCategories = false;
    }

    this.cdr.markForCheck();
  }

  @HostListener(`document:${EventTaskCreatedOrUpdate}`)
  async onTaskCreateOrUpdate() {
    await this.refresh();
  }

  @HostListener(`document:${EventStatusChanged}`)
  async onStatusCreateOrUpdate() {
    await this.refresh();
  }

  isLoading() {
    return this.loadingGroups;
  }

  onDragStart() {
    this.taskDragging = true;
  }

  onDragEnded() {
    this.taskDragging = false;
  }

  private async refresh() {
    if (this.updateLoading) return;
    this.kanbanService.resetModel();
    this.updateLoading = true;
    this.tasks = {};
    this.statusIds = [];
    this.loaders = {};
    await this.getStatuses();
    this.updateLoading = false;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        document.querySelectorAll(`.bottom-task-add`).forEach(function (elem) {
          elem.classList.remove('hide');
        });
      });
    });
  }

  editColumn(column: ITaskListGroup) {
    this.editingColumn = column;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        const input = document.querySelector(`#kanban-col-${column.id}`) as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
          this.previousColumnName = column.name;
        }
      });
    });
  }

  async changeStatusCategory(column: ITaskListGroup, categoryId?: string) {
    if (!categoryId) return;
    column.old_category_id = column.category_id;
    column.category_id = categoryId;

    await this.onBlurEditColumn(column);

    this.cdr.markForCheck();
  }

  async onBlurEditColumn(column: ITaskListGroup) {
    if (!this.projectId) return;
    if (this.isEditColProgress) return;
    if (!column.name || !column.name.trim().length) {
      if (this.previousColumnName) column.name = this.previousColumnName
      return;
    }
    try {
      this.isEditColProgress = true;
      const body = {
        name: column.name,
        project_id: this.projectId,
        category_id: column.category_id
      };
      const res = await this.statusesApi.update(column.id, body, this.projectId as string);
      if (res.done) {
        column.color_code = res.body.color_code as string;

        for (const item of column.tasks) {
          this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), item.id);
          if (item.parent_task_id) {
            this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), item.parent_task_id);
          }
        }

      } else {
        column.category_id = column.old_category_id;
      }
      this.editingColumn = null;
      this.isEditColProgress = false;
    } catch (e) {
      column.category_id = column.old_category_id;
      log_error(e);
      this.isEditColProgress = false;
    }

    this.cdr.markForCheck();
  }

  async onNameChange(column: ITaskListGroup) {
    if (!this.projectId) return;
    if (this.isEditColProgress) return;
    if (!column.name || !column.name.trim().length) {
      if (this.previousColumnName) column.name = this.previousColumnName
      return;
    }

    try {
      this.isEditColProgress = true;
      const body = {
        name: column.name,
        project_id: this.projectId,
        category_id: column.category_id
      };
      const res = await this.statusesApi.updateName(column.id, body, this.projectId as string);
      if (res.done) {
        column.color_code = res.body.color_code as string;
      }
      this.editingColumn = null;
      this.isEditColProgress = false;
    } catch (e) {
      log_error(e);
      this.isEditColProgress = false;
    }

    this.cdr.markForCheck();
  }

  async assignToMe() {
    if (!this.projectId) return;
    try {
      this.assigningTasks = true;
      const body: IBulkAssignRequest = {
        tasks: this.map.getSelectedTaskIds(),
        project_id: this.projectId
      };
      const res = await this.api.bulkAssignMe(body);
      if (res.done) {
        this.service.emitOnAssignMe(res.body);
        this.map.deselectAll();
      }
      this.assigningTasks = false;
    } catch (e) {
      this.assigningTasks = false;
      log_error(e)
    }
    this.cdr.markForCheck();
  }

  async deleteSelected() {
    if (!this.projectId || !this.contextSelectedTask) return;
    try {
      this.deletingTasks = true;

      // Select each subtask
      if (!this.contextSelectedTask.is_sub_task) {
        if (this.map._subTasksMap.has(this.contextSelectedTask.id as string)) {
          const subtasks = this.map._subTasksMap.get(this.contextSelectedTask.id as string);
          if (subtasks) {
            for (const subtask of subtasks) {
              this.map.selectTask(subtask);
            }
          }
        }
      }

      const res = await this.api.bulkDelete({tasks: this.map.getSelectedTaskIds()}, this.projectId as string);
      if (res.done) {
        for (const task of res.body.deleted_tasks) {
          this.service.deleteTask(task);
          this.service.removeSubtask(task);
        }

        if (this.contextSelectedTask.is_sub_task) {
          this.kanbanService.emitDeleteSubTask({
            parent_task_id: this.contextSelectedTask.parent_task_id
          });
          this.socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), this.contextSelectedTask.parent_task_id);
        }

      }

      this.deletingTasks = false;
    } catch (e) {
      log_error(e)
      this.deletingTasks = false;
    }
    this.contextSelectedTask = null;
    this.cdr.markForCheck();
  }

  async archiveSelected() {
    if (this.archivingTasks || !this.contextSelectedTask) return;
    try {
      // Select each subtask
      if (!this.contextSelectedTask.is_sub_task)
        if (this.map._subTasksMap.has(this.contextSelectedTask.id as string)) {
          const subtasks = this.map._subTasksMap.get(this.contextSelectedTask.id as string);
          if (subtasks) {
            for (const subtask of subtasks) {
              this.map.selectTask(subtask);
            }
          }
        }
      this.archivingTasks = true;
      const res = await this.api.bulkArchive({
        tasks: this.map.getSelectedTaskIds(),
        project_id: this.projectId as string
      }, false);

      if (res.done) {
        for (const task of res.body) {
          this.service.deleteTask(task);
        }
      }

      this.archivingTasks = false;
    } catch (e) {
      this.archivingTasks = false;
    }
    this.contextSelectedTask = null;
    this.cdr.markForCheck();
  }

  async deleteStatus(column?: ITaskListGroup): Promise<boolean> {
    if (!column || !column.id || !this.projectId) return false;
    try {
      this.selectedForDelete = column;
      this.deletingStatus = true;
      const res = await this.statusesApi.delete(column.id, this.projectId, this.replacingStatus || undefined);
      if (res.done) {
        const groupIndex = this.groups.findIndex(g => g.id === column.id);
        this.groups?.splice(groupIndex, 1);
        this.groupIds = this.groupIds.filter(id => id !== column.id);
        await this.refresh();
        return true;
      } else {
        if (res.message?.charAt(0) === "$") {
          this.replacingStatus = this.defaultStatus?.id || null;
          this.showStatusesReplaceModal = true;
          this.statusDeleteWarning = res.message.substring(1);
        }
      }
      this.deletingStatus = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.deletingStatus = false;
      this.cdr.markForCheck();
    }
    this.cdr.markForCheck();
    return false;
  }

  contextMenu($event: MouseEvent, menu: NzDropdownMenuComponent, task: IProjectTask): void {
    this.contextMenuService.create($event, menu);
    this.contextSelectedTask = task;
    this.map.selectTask(task);
  }

  closeStatusesReplaceModal() {
    this.showStatusesReplaceModal = false;
    this.statusDeleteWarning = null;
    this.selectedForDelete = null;
    this.replacingStatus = null;
  }

  async moveAndDelete() {
    const deleted = await this.deleteStatus(this.selectedForDelete as ITaskListGroup);
    // if (deleted && this.selectedForDelete?.tasks) {
    //   for (const _task of this.selectedForDelete.tasks) {
    //     if (this.replacingStatus) {
    //       _task.status = this.replacingStatus;
    //       const group = this.service.groups.find(g => g.id === this.replacingStatus);
    //       if (group) {
    //         this.map.addGroupTask(_task.status as string, _task as IProjectTask);
    //         group.tasks.push(_task);
    //         void this.init();
    //       }
    //     }
    //   }
    //   this.closeStatusesReplaceModal();
    //   this.cdr.markForCheck();
    // }
    if (deleted) {
      void this.init();
    }
    this.closeStatusesReplaceModal();
    this.cdr.markForCheck();
  }

  openCreateStatusDrawer() {
    this.showStatusModal = true;
  }

  trackByFn(index: number, data: any) {
    return data.id;
  }

  // start: create new task
  async showTaskCreateInput(columnId: string, tasksContainer: HTMLDivElement) {
    await this.resetAll();
    await this.createTempTask(columnId);
    this.tasksContainerMain = tasksContainer;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        document.querySelectorAll(`.bottom-task-add`).forEach(function (elem) {
          elem.classList.remove('hide');
        });
      });
    });
  }

  scrollBottom() {
    setTimeout(() => {
      if (this.tasksContainerMain) {
        const scrollableTaskContainer = this.tasksContainerMain;
        const selectedInput = this.inputValue.nativeElement as HTMLInputElement;
        scrollableTaskContainer.scrollTop = (this.tasksContainer.nativeElement as HTMLDivElement).scrollHeight + 100;
        selectedInput.focus();
      }
    },);
    this.cdr.detectChanges();
  }

  async onBlur() {
    setTimeout(() => {
      if (!this.newTaskName) {
        this.deleteTask();
        this.resetAll();
      }
    }, 150)
  }

  async onCreateButtonClicked(columnId: string) {
    // await new Promise<void>((resolve) => setTimeout(resolve, 150));
    this.isCreateButtonClicked = true;
    if (!this.newTaskName || this.newTaskName == DEFAULT_TASK_NAME || this.newTaskName?.trim() === "") {
      this.deleteTask();
      this.resetAll();
    } else {
      await this.updateInstantTask(columnId);
    }
  }

  createTempTask(columnId: string) {
    if (this.creatingTask) return;
    this.creatingTask = true;
    this.updatingTask = true;
    this.createButtons[columnId] = true;

    const body: ITaskCreateRequest = {
      name: this.newTaskName || DEFAULT_TASK_NAME,
      project_id: this.projectId || "",
      reporter_id: this.session?.id,
      team_id: this.session?.team_id,
      status_id: columnId
    };

    this.socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));

    this.socket.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
      this.createdMainTask = task;
      this.updatingTask = false;
      this.creatingTask = false;
      if (task?.id) {
        this.getInstantTask(task.id as string, this.projectId as string, columnId, task);
      }
    });
  }

  private getInstantTask(taskId: string, projectId: string, columnId: string, task: IProjectTask) {
    try {
      this.createButtons[columnId] = false;
      this.statusesColumns[columnId] = true;
      this.createdTaskId = taskId;
      this.kanbanService.model.task = task;
      this.scrollBottom();
    } catch (e) {
      log_error(e);
    }
  }

  private handleNewTaskAssignees = (response: ITaskAssigneesUpdateResponse) => {
    if (!this.createdMainTask) return;
    try {
      if (response) {
        this.createdMainTask.assignees = (response.assignees || []).map(m => m.team_member_id);
        this.createdMainTask.names = response.names || [];
        this.cdr.markForCheck();
      }
    } catch (e) {
      // ignore
    }
  }

  async updateInstantTask(columnId: string) {

    if (!this.createdTaskId || !this.newTaskName || this.newTaskName?.trim() === "" || this.newTaskName == DEFAULT_TASK_NAME || !this.isCreateButtonClicked) {
      void this.deleteTask();
      this.resetAll();
      return;
    }

    try {
      this.updatingTask = true;
      this.socket.emit(SocketEvents.TASK_NAME_CHANGE.toString(), JSON.stringify({
        task_id: this.createdTaskId,
        name: this.newTaskName,
        parent_task: '',
      }));
      if (this.createdMainTask) this.createdMainTask.name = this.newTaskName;
      this.socket.emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), JSON.stringify({
        task_id: this.createdTaskId,
        end_date: formatGanttDate(this.createTaskEndDate) || null,
        parent_task: '',
        time_zone: this.auth.getCurrentSession()?.timezone_name ? this.auth.getCurrentSession()?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone
      }));
      if (this.createdMainTask && this.createTaskEndDate) this.createdMainTask.end_date = this.createTaskEndDate;
      this.updatingTask = false;
      this.onNewTaskReceived(columnId)
    } catch (e) {
      log_error(e)
    }

    this.newTaskName = null;
    this.createdTaskId = null;
    this.createTaskEndDate = null;
    this.creatingTask = false;
    this.updatingTask = false;
    this.isCreateButtonClicked = false;
    this.kanbanService.resetModel();
    this.createdMainTask = null;
    // this.statusesColumns[columnId] = false;
    this.createTempTask(columnId);
    this.cdr.markForCheck();
  }

  onNewTaskReceived(groupId: string) {
    if (groupId && this.createdMainTask?.id) {
      if (this.map.has(this.createdMainTask?.id)) return;
      this.service.addTask(this.createdMainTask, groupId);
    }
  }

  async deleteTask() {
    const task = this.kanbanService.model.task;
    if (!task || !task.id) return;
    try {
      const res = await this.api.delete(task.id);
      if (res.done) {
        const count = this.kanbanService.model.task?.sub_tasks_count || 0;
        if (this.kanbanService.model.task)
          this.kanbanService.model.task.sub_tasks_count = Math.max(count - 1, 0);
        this.kanbanService.emitDelete({
          id: task.id,
          parent_task_id: task.parent_task_id,
          project_id: this.projectId as string
        });
        this.kanbanService.emitRefresh(task.id);
      }
    } catch (e) {
      log_error(e);
    }
  }

  checkForPastDate(endDate: any) {
    const formattedEndDate = moment(endDate).format('YYYY-MM-DD');
    return formattedEndDate < moment().format('YYYY-MM-DD');
  }

  checkForSoonDate(endDate: any) {
    const formattedEndDate = moment(endDate).format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    return formattedEndDate === moment().format('YYYY-MM-DD') || formattedEndDate === tomorrow;
  }

  resetAll() {
    for (const singleCard in this.statusesColumns) {
      this.statusesColumns[singleCard] = false;
    }
    this.tasksContainerMain = null;
    this.newTaskName = null;
    this.createdTaskId = null;
    this.createTaskEndDate = null;
    this.creatingTask = false;
    this.updatingTask = false;
    this.isCreateButtonClicked = false;
    this.createdMainTask = null
    this.kanbanService.resetModel();
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        document.querySelectorAll(`.bottom-task-add`).forEach(function (elem) {
          elem.classList.remove('hide');
        });
      });
    });
  }

}
