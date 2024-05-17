import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  Output,
  Renderer2
} from '@angular/core';
import {IWLMember, IWLTaskListGroup, IWLTasksConfig} from "@interfaces/workload";
import {deepClone} from "@shared/utils";
import {ProjectWorkloadApiService} from "@api/project-workload-api.service";
import {AvatarNamesMap} from "@shared/constants";
import {Socket} from "ngx-socket-io";
import {WlTasksHashMapService} from "../../services/wl-tasks-hash-map.service";
import {UtilsService} from "@services/utils.service";
import {WlTasksService} from "../../services/wl-tasks.service";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {IGroupByOption, ITaskListGroup} from "../../../../../modules/task-list-v2/interfaces";
import {TaskStatusesApiService} from "@api/task-statuses-api.service";
import {TaskPrioritiesService} from "@api/task-priorities.service";
import {TaskPhasesApiService} from "@api/task-phases-api.service";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {Promise} from "@rx-angular/cdk/zone-less/browser";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-member-tasks-drawer',
  templateUrl: './member-tasks-drawer.component.html',
  styleUrls: ['./member-tasks-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberTasksDrawerComponent {
  private _show = false;
  get show(): boolean {
    return this._show;
  }

  @Input() set show(value: boolean) {
    if (value === this._show) return;
    this._show = value;
  }

  @Input({required: true}) teamMember: IWLMember | null = null;
  @Input({required: true}) projectId: string | null = null;
  @Input({required: true}) activeTab: number = 0;
  @Output() showChange: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() onOpenTask = new EventEmitter<IProjectTask>();

  private readonly DRAWER_CLOSE_TIME = 100;

  readonly BODY_STYLE = {
    padding: 0,
    overflowX: 'hidden',
    overflowY: 'auto'
  };

  loading = false;
  protected loadingGroups = false;
  protected loadingStatuses = false;
  protected loadingPriorities = false;
  protected loadingPhases = false;
  protected loadingCategories = false;

  protected groupIds: string[] = [];

  protected selectedTask: IProjectTask | null = null;
  protected categories: ITaskStatusCategory[] = [];

  protected get groups() {
    return this.service.groups;
  }

  get selectedGroup() {
    return this.service.getCurrentGroup();
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ProjectWorkloadApiService,
    private readonly ngZone: NgZone,
    private readonly map: WlTasksHashMapService,
    private readonly socket: Socket,
    private readonly renderer: Renderer2,
    public readonly service: WlTasksService,
    public readonly utils: UtilsService,
    private readonly statusesApi: TaskStatusesApiService,
    private readonly prioritiesApi: TaskPrioritiesService,
    private readonly phasesApi: TaskPhasesApiService,
    private readonly taskViewService: TaskViewService
  ) {
    this.service.setCurrentGroup(this.service.GROUP_BY_OPTIONS[0]);

    this.taskViewService.onSingleMemberChange.pipe(takeUntilDestroyed())
      .subscribe(async (teamMemberId: string) => {
        if (teamMemberId === this.teamMember?.team_member_id) {
          await this.getGroups(false);
        }
        this.cdr.markForCheck();
      });

    this.taskViewService.onDelete
      .pipe(takeUntilDestroyed())
      .subscribe(async task => {
        this.init();
      })

    this.service.onRemoveMembersTask.pipe(takeUntilDestroyed()).subscribe( (taskId: string) => {
      this.service.deleteTask(taskId);
    })

  }

  tabChange(index: number) {
    this.activeTab = index;
    switch (index) {
      case 0:
        this.service.emitUpdateOverviewCharts();
        break;
      case 1:
        this.service.currentTab = "";
        void this.getGroups(true);
        break;
      case 2:
        this.service.currentTab = "start_date_null"
        void this.getGroups(true);
        break;
      case 3:
        this.service.currentTab = "end_date_null"
        void this.getGroups(true);
        break;
      case 4:
        this.service.currentTab = "start_end_dates_null"
        void this.getGroups(true);
        break;
    }
  }

  private init() {
    this.service.isSubtasksIncluded = true;
    void Promise.all([
      this.tabChange(this.activeTab),
      // this.getGroups(true),
      this.getStatuses(),
      this.getPriorities(),
      this.getCategories(),
      this.getPhases()
    ])
    ;
  }

  private getConf(parentTaskId?: string): IWLTasksConfig {
    const config: IWLTasksConfig = {
      id: this.projectId as string,
      members: this.teamMember ? this.teamMember.team_member_id as string : '',
      archived: false,
      group: this.service.getCurrentGroup().value,
      isSubtasksInclude: false,
      dateChecker: this.service.currentTab
    };

    if (parentTaskId)
      config.parent_task = parentTaskId;

    return config;
  }

  private async getGroups(loading = true) {
    if (!this.projectId || !this.teamMember) return;
    try {
      this.map.deselectAll();
      this.loadingGroups = loading;
      const config = this.getConf();
      config.isSubtasksInclude = this.service.isSubtasksIncluded;
      const res = await this.api.getTasksByMember(config) as IServerResponse<IWLTaskListGroup[]>;
      if (res.done) {
        const groups = deepClone(res.body);
        this.groupIds = groups.map((g: IWLTaskListGroup) => g.id);
        this.mapTasks(groups);
        this.service.groups = groups;
      }
      this.loadingGroups = false;
    } catch (e) {
      this.loadingGroups = false;
    }
    this.cdr.markForCheck();
  }

  private mapTasks(groups: IWLTaskListGroup[]) {
    for (const group of groups) {
      this.map.registerGroup(group);
      for (const task of group.tasks) {
        if (task.start_date) task.start_date = new Date(task.start_date) as any;
        if (task.end_date) task.end_date = new Date(task.end_date) as any;
      }
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
      const res = await this.phasesApi.get(this.projectId);
      if (res.done)
        this.service.phases = res.body;
    } catch (e) {
    }
  }

  handleCancel() {
    if (this._show) {
      this._show = false;
      this.showChange.emit(this._show);
    }
  }

  onVisibilityChange(visible: boolean) {
    if (visible) {
      setTimeout(() => this.init(), this.DRAWER_CLOSE_TIME);
    }
  }

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  protected trackById(index: number, item: any) {
    return item.id;
  }

  protected openTask(task: IProjectTask) {
    this.onOpenTask.emit(task)
    this.cdr.markForCheck();
  }

  async toggleCollapse(group: IWLTaskListGroup | IProjectTask) {
    if (this.isTaskListGroup(group)) {
      group.isExpand = !group.isExpand;
    }
    this.cdr.detectChanges();
  }

  isTaskListGroup(group: ITaskListGroup | IProjectTask): group is ITaskListGroup {
    return (group as ITaskListGroup).tasks !== undefined;
  }

  private toggleFocusCls(focused: boolean, element: HTMLElement) {
    if (focused) {
      this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
    } else {
      this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
    }
  }

  changeGroup(item: IGroupByOption) {
    this.service.setCurrentGroup(item);
    this.init();
  }

  protected handleFocusChange(focused: boolean, element: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      this.toggleFocusCls(focused, element);
    });
  }

  unuseFunc(e: any, row: any, group: any) {
    return;
  }

}
