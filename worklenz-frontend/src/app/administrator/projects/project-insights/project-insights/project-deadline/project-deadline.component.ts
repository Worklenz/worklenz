import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {ProjectInsightsService} from "@api/project-insights.service";
import {ActivatedRoute, Router} from "@angular/router";
import {log_error} from "@shared/utils";
import {IDeadlineTaskStats} from "@interfaces/api-models/project-insights";
import {format} from "date-fns";
import {Socket} from "ngx-socket-io";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {UtilsService} from "@services/utils.service";
import {TaskStatusesApiService} from "@api/task-statuses-api.service";
import {ProjectFormModalComponent} from "../../../../components/project-form-modal/project-form-modal.component";

@Component({
  selector: 'worklenz-project-deadline',
  templateUrl: './project-deadline.component.html',
  styleUrls: ['./project-deadline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectDeadlineComponent implements OnInit, OnChanges {
  @ViewChild(ProjectFormModalComponent) projectsForm!: ProjectFormModalComponent;
  @Input() archived = false;

  private readonly includeArchivedTasks = "include-archived-tasks";

  loading = false;
  loadingStatuses = false;
  showTaskDrawer = false;

  deadlineStats: IDeadlineTaskStats = {};
  taskStatuses: ITaskStatusViewModel[] = [];

  selectedTaskId: string | null = null;

  projectId: string = '';

  constructor(
    private socket: Socket,
    public utils: UtilsService,
    private api: ProjectInsightsService,
    private statusesApi: TaskStatusesApiService,
    private route: ActivatedRoute,
    private router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
  }

  ngOnInit() {
    // void this.get();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.get();
  }

  get archivedTasksChoice() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.getProjectDeadlineStats(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.deadlineStats = res.body;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  getProjectEndDate(project_end_date: string = '') {
    return project_end_date ? format(new Date(project_end_date), 'yyyy-MM-dd') : ''
  }

  back() {
    this.router.navigate(['/worklenz/projects']);
  }
}
