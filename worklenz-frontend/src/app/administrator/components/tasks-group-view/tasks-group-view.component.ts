import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ISubTask} from "@interfaces/sub-task";
import {log_error} from "@shared/utils";
import {TaskStatusesApiService} from "@api/task-statuses-api.service";
import {TasksApiService} from "@api/tasks-api.service";
import {ActivatedRoute} from "@angular/router";
import {SubTasksApiService} from "@api/sub-tasks-api.service";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NgForOf} from "@angular/common";

@Component({
  selector: 'worklenz-tasks-group-view',
  templateUrl: './tasks-group-view.component.html',
  styleUrls: ['./tasks-group-view.component.scss'],
  imports: [
    NzSkeletonModule,
    NzTypographyModule,
    NgForOf
  ],
  standalone: true
})
export class TasksGroupViewComponent implements OnInit {
  @Output() addTask: EventEmitter<any> = new EventEmitter<any>();
  @Output() editTask: EventEmitter<string> = new EventEmitter<string>();

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

  loadingStatuses = false;
  showTaskModal = false;
  updateLoading = false;
  showStatusModal = false;
  loadingTasks = false;
  loadingSubTasks = false;

  selectedTaskId: string | null = null;
  selectedStatusId: string | null = null;
  taskDragging: boolean = false;

  subTasks: ISubTask[] = [];

  constructor(
    private api: TasksApiService,
    private statusesApi: TaskStatusesApiService,
    private subTasksApi: SubTasksApiService,
    private route: ActivatedRoute
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id');
  }

  ngOnInit(): void {
    this.getStatuses().then(r => r);
  }

  async getTasksByStatus(index: number, status: string, id: string) {
    if (!this.projectId) return;
    try {
      this.loaders[status] = true;
      this.loadingTasks = true;
      const res = await this.api.getTasksByStatus(this.projectId, status);
      if (res.done) {
        this.tasks[index] = {};
        this.tasks[index].id = id;
        this.tasks[index].label = status;
        this.tasks[index].data = res.body;
      }
      this.loaders[status] = false;
      this.loadingTasks = false;
    } catch (e) {
      log_error(e);
      this.loadingTasks = false;
      this.loaders[status] = false;
    }
  }

  async getGroupedTasks() {
    for (let i = 0; i < this.taskStatuses.length; i++) {
      const status = this.taskStatuses[i];
      this.statusIds.push(status.id || '');
      if (status.name && status.id)
        await this.getTasksByStatus(i, status.name, status.id);
    }
  }

  async getStatuses() {
    if (!this.projectId) return;
    try {
      this.loadingStatuses = true;
      const res = await this.statusesApi.get(this.projectId);
      if (res.done) {
        this.taskStatuses = res.body;
      }
      this.loadingStatuses = false;
    } catch (e) {
      log_error(e);
      this.loadingStatuses = false;
    }
  }

  async showSubTasks(task: IProjectTask) {
    if (!task.id && task.sub_tasks_loading) return;
    task.sub_tasks_loading = true;
    task.show_sub_tasks = !task.show_sub_tasks;
    if (task.show_sub_tasks) {
      try {
        const res = await this.subTasksApi.get(task.id || '');
        if (res.done) {
          task.sub_tasks = res.body;
          task.sub_tasks_loading = false;
        }
      } catch (e) {
        log_error(e);
        task.sub_tasks_loading = false;
      }
    } else {
      task.sub_tasks = [];
      task.sub_tasks_loading = false;
    }
  }

  viewTasks(status: ITaskStatusViewModel) {
    try {

    } catch (e) {

    }
  }
}
