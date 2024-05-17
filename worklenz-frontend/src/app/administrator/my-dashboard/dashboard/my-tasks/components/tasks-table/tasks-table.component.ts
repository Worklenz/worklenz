import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {log_error} from "@shared/utils";
import {AuthService} from "@services/auth.service";
import {IMyTask} from "@interfaces/my-tasks";
import {HomePageApiService} from "@api/home-page-api.service";
import {HomepageService} from "../../../../homepage-service.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {merge} from "rxjs";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {ProjectsService} from "../../../../../projects/projects.service";
import {IProjectViewModel} from "@interfaces/api-models/project-view-model";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";
import {IProject} from "@interfaces/project";

@Component({
  selector: 'worklenz-tasks-table',
  templateUrl: './tasks-table.component.html',
  styleUrls: ['./tasks-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TasksTableComponent implements OnInit {
  private session: ILocalSession | null = null;
  protected selectedTask: IProjectTask | null = null;

  projects: IProject[] = [];

  loading = false;
  showTaskModal = false;

  constructor(
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly homePageApi: HomePageApiService,
    private readonly projectService: ProjectsService,
    private readonly taskViewService: TaskViewService,
    public readonly homePageService: HomepageService
  ) {

    this.homePageService.newTaskReceived
      .pipe(takeUntilDestroyed())
      .subscribe(task => {
        this.handleNewTaskReceived(task);
      });

    this.taskViewService.onViewBackFrom
      .pipe(takeUntilDestroyed())
      .subscribe(task => {
        const task_: IProjectTask = {
          id: task.parent_task_id,
          project_id: task.project_id,
        }
        this.handleTaskSelectFromView(task_);
      });

    this.taskViewService.onSelectSubTask
      .pipe(takeUntilDestroyed())
      .subscribe(task => {
        this.handleTaskSelectFromView(task);
      });

    this.homePageService.onGetTasks
      .pipe(takeUntilDestroyed())
      .subscribe(config => {
        this.getTasks(true);
      })

    this.homePageService.onGetTasksWithoutLoading
      .pipe(takeUntilDestroyed())
      .subscribe(config => {
        this.getTasks(false);
      })

    merge(
      this.taskViewService.onAssigneesChange,
      this.taskViewService.onEndDateChange,
      this.taskViewService.onStatusChange
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.getTasks(false);
      });

    this.taskViewService.onDelete
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        if (value.parent_task_id) {
          const task_: IProjectTask = {
            id: value.parent_task_id,
            project_id: value.project_id as string
          }
          this.handleTaskSelectFromView(task_);
        }
        void this.getTasks(false);
      });
  }

  ngOnInit() {
    this.session = this.auth.getCurrentSession();
    this.getProjects();
    this.getTasks(true);
  }

  async getProjects() {
    const team_id = this.session?.team_id;
    if (!team_id) return;
    try {
      const res = await this.homePageApi.getProjectsByTeam();
      if (res) {
        this.projects = res.body;
      }
    } catch (e) {
      log_error(e);
    }
    this.cdr.markForCheck();
  }

  async getTasks(isloading: boolean) {
    if (!this.homePageService.tasksViewConfig) return;
    try {
      this.loading = isloading;
      this.homePageService.loadingTasks = true;
      let config = this.homePageService.tasksViewConfig;
      config.time_zone = this.session?.timezone_name ? this.session?.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await this.homePageApi.getMyTasks(config);
      if (res) {
        this.homePageService.tasksModel = res.body;
      }
      this.loading = false;
      this.homePageService.loadingTasks = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
      this.homePageService.loadingTasks = false;
    }

    this.cdr.markForCheck();
  }

  private handleTaskSelectFromView(task: IProjectTask) {
    this.showTaskModal = false;
    setTimeout(() => {
      if (task) {
        this.openTask(task);
        this.cdr.markForCheck();
      }
    }, DRAWER_ANIMATION_INTERVAL);
    this.cdr.detectChanges();
  }

  protected openTask(task: IProjectTask) {
    this.selectedTask = task;
    if (task.project_id) this.projectService.id = task.project_id;
    this.showTaskModal = true;
    this.cdr.markForCheck();
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.selectedTask = null;
    }
  }

  handleNewTaskReceived(task: IMyTask): void {
    if (!task) return;
    const receivedTask: IMyTask = {
      id: task.id,
      name: task.name,
      project_id: task.project_id,
      status: task.status,
      end_date: task.end_date,
      is_task: true,
      done: false,
      project_color: task.project_color,
      project_name: task.project_name,
      team_id: this.session?.team_id,
      status_color: task.status_color?.slice(0, -2),
      project_statuses: task.project_statuses
    }
    // change tasks count on tabs
    this.homePageService.tasksModel.total++;

    // add task to all tab
    if (this.homePageService.tasksViewConfig?.current_tab === 'All') {
      this.homePageService.tasksModel.tasks.unshift(receivedTask);
    }

    // add task to no due date tab and increase count
    if (!task.end_date) {
      this.homePageService.tasksModel.no_due_date++;
      if (this.homePageService.tasksViewConfig?.current_tab === 'NoDueDate') {
        this.homePageService.tasksModel.tasks.unshift(receivedTask);
      }
    }

    if (task.end_date) {
      const dateToCheck = new Date(task.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // add task to today tab and increase count
      if (dateToCheck.toDateString() === today.toDateString()) {
        this.homePageService.tasksModel.today++;
        if (this.homePageService.tasksViewConfig?.current_tab === 'Today') {
          this.homePageService.tasksModel.tasks.unshift(receivedTask);
        }
      } else if (dateToCheck > today) {
        this.homePageService.tasksModel.upcoming++;
        if (this.homePageService.tasksViewConfig?.current_tab === 'Upcoming') {
          this.homePageService.tasksModel.tasks.unshift(receivedTask);
        }
      }
    }

    this.cdr.markForCheck();
  }

  trackBy(index: number, item: IProjectViewModel) {
    return item.id;
  }

}
