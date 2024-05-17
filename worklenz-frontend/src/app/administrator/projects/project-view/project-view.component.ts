import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup} from "@angular/forms";
import {ActivatedRoute, NavigationEnd, Router} from "@angular/router";
import {ProjectsApiService} from "@api/projects-api.service";
import {TasksApiService} from "@api/tasks-api.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {IProjectViewModel} from "@interfaces/api-models/project-view-model";
import {ITaskCreateRequest} from "@interfaces/api-models/task-create-request";
import {EGanttChartTypes} from "@interfaces/gantt-chart";
import {ITask} from "@interfaces/task";
import {AppService} from "@services/app.service";
import {AuthService} from "@services/auth.service";
import {DEFAULT_TASK_NAME, UNMAPPED} from "@shared/constants";
import {dispatchTasksChange} from "@shared/events";
import {SocketEvents} from "@shared/socket-events";
import {log_error} from "@shared/utils";
import {Socket} from "ngx-socket-io";
import {ProjectFormModalComponent} from "../../components/project-form-modal/project-form-modal.component";
import {ProjectsService} from "../projects.service";
import {TaskListV2Service} from "../../modules/task-list-v2/task-list-v2.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {NotificationSettingsService} from "@services/notification-settings.service";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {ProjectPhasesService} from "@services/project-phases.service";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {ProjectFormService} from '@services/project-form-service.service';
import {Location} from "@angular/common";
import {filter} from "rxjs";
import {ProjectUpdatesDrawerComponent} from "@admin/components/project-updates-drawer/project-updates-drawer.component";
import {ProjectCommentsApiService} from "@api/project-comments-api.service";
import {ProjectUpdatesService} from "@services/project-updates.service";
import {
  ProjectTemplateCreateDrawerComponent
} from "@admin/components/project-template-create-drawer/project-template-create-drawer.component";
import {RoadmapV2Service} from "../../modules/roadmap-v2/project-roadmap-v2-custom/services/roadmap-v2-service.service";

@Component({
  selector: 'worklenz-project-view',
  templateUrl: './project-view.component.html',
  styleUrls: ['./project-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectViewComponent implements OnInit, OnDestroy {
  @ViewChild(ProjectFormModalComponent) projectsForm!: ProjectFormModalComponent;
  @ViewChild(ProjectUpdatesDrawerComponent) projectUpdatesDrawer!: ProjectUpdatesDrawerComponent;
  @ViewChild(ProjectTemplateCreateDrawerComponent) projectTemplateCreateDrawer!: ProjectTemplateCreateDrawerComponent;

  tasksSearchForm!: FormGroup;

  readonly ganttType = EGanttChartTypes;
  readonly options = [
    {label: 'Group', value: 0, icon: 'appstore'},
    {label: 'List', value: 1, icon: 'bars'}
  ];
  readonly tabs = [
    {label: 'Task List', tab: 'tasks-list', index: 0, isPinned: false},
    {label: 'Board', tab: 'board', index: 1, isPinned: false},
    {label: 'Workload', tab: 'workload', index: 2, isPinned: false},
    {label: 'Roadmap', tab: 'roadmap', index: 3, isPinned: false},
    {label: 'Insights', tab: 'project-insights-member-overview', index: 4, isPinned: false},
    {label: 'Files', tab: 'all-attachments', index: 5, isPinned: false},
    {label: 'Members', tab: 'members', index: 6, isPinned: false}
  ];

  projects: IProjectViewModel[] = [];
  project: IProjectViewModel = {};
  selectedTask: ITask = {};

  private session: ILocalSession | null = null;

  loading = true;
  projectId: string | null = null;
  selectedTaskId: string | null = null;

  refreshing = false;
  showInviteMembersModal = false;
  importTemplateVisible = false;
  taskUpdated = false;
  creatingTask = false;
  ownerOrAdmin = false;
  projectManager = false;
  showTaskModal = false;
  showDescriptionModel = false;
  backButtonClicked = false;

  selectedTabIndex = 0;
  currentTabIndex = 0;
  tasksViewMode = 0;
  defaultView = 0;
  pinnedTabIndex = 0;

  enableBadge = false;

  constructor(
    private readonly app: AppService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly projectsApiService: ProjectsApiService,
    private readonly tasksService: TasksApiService,
    private readonly fb: FormBuilder,
    private readonly service: ProjectsService,
    private readonly list: TaskListV2Service,
    private readonly socket: Socket,
    private readonly notificationSettings: NotificationSettingsService,
    private readonly phasesService: ProjectPhasesService,
    private readonly cdr: ChangeDetectorRef,
    private readonly taskView: TaskViewService,
    private readonly location: Location,
    private readonly projectFormService: ProjectFormService,
    private readonly projectCommentsApi: ProjectCommentsApiService,
    private readonly projectCommentsService: ProjectUpdatesService,
    private readonly roadmapService: RoadmapV2Service,
    private readonly projectsService: ProjectsService
  ) {

    this.app.setTitle('Loading...');

    this.setProjectId();
    this.setDefaultTab();
    this.setPinnedTab();

    this.tasksSearchForm = this.fb.group({
      search: []
    });

    this.notificationSettings.onNotificationClick
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.setProjectId();
        this.refresh();
        void this.getProject();
        this.handleTaskViewOpened();
      });

    this.projectFormService.onProjectUpdate
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.getProject();
      })

    this.projectCommentsService.onBadgeDisable
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.enableBadge = false;
      })

    this.session = this.auth.getCurrentSession();
  }

  get getLocalUpdatesCount() {
    if (!this.projectId) return 0;
    const count = localStorage.getItem("worklenz.project.updates-" + this.projectId);
    return count ? +count : 0;
  }

  hasUnreadUpdates() {
    return this.getLocalUpdatesCount === 0;
  }

  async ngOnInit() {
    this.ownerOrAdmin = this.auth.isOwnerOrAdmin();
    this.projectManager = this.isProjectManager();
    void this.getProject();
    this.handleTaskViewOpened();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.handleBackNavigation();
      });

    window.onpopstate = (event) => {
      this.backButtonClicked = true;
    };

    this.getUpdatesCount();

    this.socket.on(SocketEvents.NEW_PROJECT_COMMENT_RECEIVED.toString(), () => {
      this.enableBadge = true;
      this.cdr.detectChanges();
    });

  }

  ngOnDestroy(): void {
    window.onpopstate = null;
    this.socket.removeListener(SocketEvents.NEW_PROJECT_COMMENT_RECEIVED.toString(), () => {
      return
    });
  }

  private handleBackNavigation(): void {
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (this.backButtonClicked && !tabParam) {
      this.router.navigateByUrl('/worklenz/projects');
    }
    this.backButtonClicked = false;
  }

  private setProjectId() {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.service.id = this.projectId;
  }

  openCreateTaskModal() {
    void this.addInstantTask();
  }

  private isGroupByPhase() {
    return this.list.getCurrentGroup().value === this.list.GROUP_BY_PHASE_VALUE;
  }

  isProjectManager() {
    if (this.projectsService.projectOwnerTeamMemberId) return this.auth.getCurrentSession()?.team_member_id === this.projectsService.projectOwnerTeamMemberId;
    return false;
  }

  async addInstantTask() {
    try {
      this.creatingTask = true;
      const session = this.auth.getCurrentSession();

      const body: ITaskCreateRequest = {
        name: DEFAULT_TASK_NAME,
        project_id: this.projectId ?? "",
        reporter_id: session?.id,
        team_id: session?.team_id,
        chart_start: this.roadmapService.chartStartDate ? this.roadmapService.chartStartDate : ''
      };

      this.socket.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
        if (task?.id) {
          this.selectedTask = task;
          this.selectedTaskId = task.id;
          this.showTaskModal = true;

          this.taskView.emitOpenTask({
            task_id: task.id || null,
            project_id: task.project_id || null
          });

          // add the new task to the task list
          const groupId = this.isGroupByPhase() ? UNMAPPED : this.list.getGroupIdByGroupedColumn(task);
          if (groupId)
            this.list.addTask(task, groupId);
          this.service.emitNewTaskCreated(task);
        }
        this.creatingTask = false;
        this.cdr.markForCheck();
      });
      this.socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
    } catch (e) {
      log_error(e);
      this.creatingTask = false;
    }

    this.cdr.markForCheck();
  }

  async getTasks() {
    if (!this.projectId) return;
    try {
      this.loading = !this.taskUpdated;
      await this.tasksService.getTasksByProject(this.projectId);
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  async getUpdatesCount() {
    if (!this.projectId) return;
    try {
      const res = await this.projectCommentsApi.getCountByProjectId(this.projectId);
      if (res) {
        if (this.getLocalUpdatesCount < res.body) {
          this.enableBadge = true;
        }
      }
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async getProjectManager() {
    if (!this.projectId) return;
    try {
      const res = await this.projectsApiService.getProjectManager(this.projectId);
      if (res.done) {
      }
    } catch (e) {
      log_error(e)
      this.cdr.markForCheck();
    }
  }

  onTaskCreateOrUpdate() {
    this.taskUpdated = true;
    void this.getTasks();
    this.selectedTaskId = null;
    this.taskUpdated = false;
    this.cdr.markForCheck();
  }

  async getProject() {
    if (!this.projectId) return;
    try {
      this.loading = true;
      const res = await this.projectsApiService.getById(this.projectId);
      this.loading = false;
      if (res.done) {
        this.project = res.body;
        if (this.project) {
          if (this.project.project_manager && (this.auth.getCurrentSession()?.team_member_id === this.project.project_manager?.id)) {
            this.service.projectOwnerTeamMemberId = this.project.project_manager.id as string;
          } else {
            this.service.projectOwnerTeamMemberId = null;
          }
        }
        if (!this.project) {
          this.back();
          return;
        }

        if (this.project.name)
          this.app.setTitle(this.project.name);
        if (res.body.phase_label)
          this.phasesService.updateLabel(res.body.phase_label);
      }
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  tabChanged(event: number) {
    this.currentTabIndex = event;
    if (this.currentTabIndex !== 1) {
      this.tasksViewMode = 0;
    }

    this.cdr.markForCheck();
  }

  openProjectForm() {
    if (!this.projectId) return;
    this.projectsForm?.open(this.projectId, true);
  }

  back() {
    void this.router.navigate(['/worklenz/projects']);
    this.service.projectOwnerTeamMemberId = null;
  }

  refresh() {
    this.refreshing = true;
    setTimeout(() => {
      this.refreshing = false;
      this.cdr.markForCheck();
    }, 10);
  }

  refreshAll() {
    setTimeout(() => {
      window.location.reload();
      this.cdr.markForCheck();
    }, 1);
  }

  private setDefaultTab() {
    if (!this.route.snapshot.queryParamMap.get('tab')) {
      void this.router.navigate(
        [],
        {
          relativeTo: this.route,
          queryParams: {tab: this.route.snapshot.queryParamMap.get('tab')},
          queryParamsHandling: 'merge', // remove to replace all query params by provided
        });
    } else {
      switch (this.route.snapshot.queryParamMap.get('tab')) {
        case 'tasks-list':
          this.selectedTabIndex = 0
          break;
        case 'board':
          this.selectedTabIndex = 1
          break;
        case 'workload':
          this.selectedTabIndex = 2
          break;
        case 'roadmap':
          this.selectedTabIndex = 3
          break;
        case 'project-insights-member-overview':
          this.selectedTabIndex = 4
          break;
        case 'all-attachments':
          this.selectedTabIndex = 5
          break;
        case 'members':
          this.selectedTabIndex = 6
          break;
        case 'updates':
          this.selectedTabIndex = 7
          break;
        default : this.selectedTabIndex = 0;
      }
    }
  }

  private setPinnedTab() {
    if(this.route.snapshot.queryParamMap.get('pinned_tab')) {

    }
    this.tabs.forEach( (tab) => {
      tab.isPinned = false
    });
    if(this.route.snapshot.queryParamMap.get('tab') === 'board') {
      this.selectedTabIndex = 1;
    }
    if(this.route.snapshot.queryParamMap.get('pinned_tab') === 'board') {
      this.pinnedTabIndex = 1;
    }
    this.tabs[this.pinnedTabIndex].isPinned = true;
  }

  openImportTasksDrawer(): void {
    this.importTemplateVisible = true;
    this.cdr.markForCheck();
  }

  importDone() {
    dispatchTasksChange();
    this.closeImport();
  }

  closeImport() {
    this.importTemplateVisible = false;
    this.cdr.markForCheck();
  }

  openInviteMembersDrawer() {
    this.showInviteMembersModal = true;
  }

  private handleTaskViewOpened() {
    const id = this.route.snapshot.queryParamMap.get("task");
    if (id) {
      this.selectedTaskId = id;
      this.showTaskModal = true;
      this.cdr.markForCheck();
    }
  }

  toggleProjectSubscription() {
    if (!this.projectId) return;
    this.project.subscribed = !this.project.subscribed;
    const body = {
      project_id: this.projectId,
      user_id: this.session?.id,
      team_member_id: this.session?.team_member_id,
      mode: this.project.subscribed ? 0 : 1
    };
    this.socket.emit(SocketEvents.PROJECT_SUBSCRIBERS_CHANGE.toString(), body);
  }

  openTemplateCreateDrawer() {
    this.projectTemplateCreateDrawer.open();
  }

  async updatePinnedView(pinnedTabIndex: number) {
    if(!this.projectId) return;
    try {
      const res = await this.projectsApiService.updateDefaultView(this.projectId, pinnedTabIndex);
      if(res.done) {
        this.tabs.forEach( (tab) => {
          tab.isPinned = false
        });

        this.pinnedTabIndex = pinnedTabIndex;
        this.tabs[pinnedTabIndex].isPinned = true;

        this.router.navigate([], {
          queryParams: { pinned_tab: pinnedTabIndex === 1 ? 'board' : 'tasks-list'},
          queryParamsHandling: 'merge'
        });

      }
    } catch (e) {

    }
    this.cdr.markForCheck();
  }

}
