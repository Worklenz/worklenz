import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {ProjectInsightsService} from "@api/project-insights.service";
import {IProjectInsightsGetRequest} from "@interfaces/api-models/project-insights";
import {log_error} from "@shared/utils";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {TaskStatusesApiService} from "@api/task-statuses-api.service";
import {UtilsService} from "@services/utils.service";
import {Socket} from "ngx-socket-io";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {formatDate} from '@angular/common';
import {ProjectInsightsComponent} from '../project-insights.component';
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {TeamMembersApiService} from "@api/team-members-api.service";
import {AuthService} from "@services/auth.service";

@Component({
  selector: 'worklenz-task-insights',
  templateUrl: './task-insights.component.html',
  styleUrls: ['./task-insights.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskInsightsComponent implements OnChanges {
  @Input() archived = false;
  @ViewChild('projectOverviewChart') projectOverviewChart!: ElementRef;
  @ViewChild('tasksInsightsExportDiv') tasksInsightsExportDiv: ElementRef | undefined;
  @ViewChild('memberSearchInput', {static: false}) memberSearchInput!: ElementRef<HTMLInputElement>;

  private readonly includeArchivedTasks = "include-archived-tasks";

  private readonly highlight = 'highlight-col';

  projectId: string = '';

  overviewData: IProjectInsightsGetRequest = {};
  taskStatuses: ITaskStatusViewModel[] = [];
  members: ITeamMemberViewModel[] = [];
  data: IProjectTask = {};

  overdueTasks: any = [];
  overloggedTasks: any = [];
  earlyTasks: any = [];
  lateTasks: any = [];

  loadingOverdue = true;
  loadingOverlogged = true;
  loadingEarlyTasks = true;
  loadingLateTasks = true;
  loadingOverviewData = false;
  loadingStatuses = false;

  completed = 0;
  pending = 0;

  showTaskDrawer = false;

  selectedTaskId: string | null = null;
  memberSearchText: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router,
    private api: ProjectInsightsService,
    private statusesApi: TaskStatusesApiService,
    private teamMembersApi: TeamMembersApiService,
    public utils: UtilsService,
    private socket: Socket,
    private projectInsightsComponent: ProjectInsightsComponent,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
  }

  ngOnInit(): void {
    // this.getData();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.getData();
  }

  getData() {
    this.getOverdueTasks();
    this.getEarlyTasks();
    this.getLateTasks();
    this.getProjectOverviewData();
    this.getOverloggedTasks();
  }

  get archivedTasksChoice() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  async getOverdueTasks() {
    try {
      this.loadingOverdue = true;
      const res = await this.api.getOverdueTasks(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.overdueTasks = res.body;
      }
      this.loadingOverdue = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingOverdue = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async getEarlyTasks() {
    try {
      this.loadingEarlyTasks = true;
      const res = await this.api.getTasksCompletedEarly(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.earlyTasks = res.body;
      }
      this.loadingEarlyTasks = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingEarlyTasks = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async getLateTasks() {
    try {
      this.loadingLateTasks = true;
      const res = await this.api.getTasksCompletedLate(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.lateTasks = res.body;
      }
      this.loadingLateTasks = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingLateTasks = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async getProjectOverviewData() {
    try {
      this.loadingOverviewData = true;
      const res = await this.api.getProjectOverviewData(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.overviewData = res.body;
      }
      this.loadingOverviewData = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingOverviewData = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async getOverloggedTasks() {
    try {
      this.loadingOverlogged = true;
      const res = await this.api.getOverloggedTasks(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.overloggedTasks = res.body;
      }
      this.loadingOverlogged = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingOverlogged = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  onCreateOrUpdate() {
    this.showTaskDrawer = false;
    this.selectedTaskId = null;
    this.cdr.markForCheck();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  goToList() {
    this.router.navigate([], {
      relativeTo: this.route, queryParams: {tab: "tasks-list"}, queryParamsHandling: 'merge', // remove to replace all query params by provided
    });
  }

  exportTaskInsights(projectName: string | null) {
    if (this.tasksInsightsExportDiv) {
      this.projectInsightsComponent.isLoading = true;
      html2canvas(this.tasksInsightsExportDiv.nativeElement).then((canvas) => {
        let img = canvas.toDataURL("image/PNG");
        let doc = new jsPDF('p', 'mm', 'a4', true);
        const bufferX = 5;
        const bufferY = 28;
        const imgProps = (<any>doc).getImageProperties(img);
        const pdfWidth = doc.internal.pageSize.getWidth() - 2 * bufferX;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let LogoImg = new Image();
        LogoImg.src = location.origin + '/assets/images/logo.png';
        doc.addImage(LogoImg, 'PNG', (doc.internal.pageSize.getWidth() / 2) - 12, 5, 30, 6.5);
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0, 0.85);
        doc.text([`Insights - ` + projectName + ` - Tasks`, `${formatDate(new Date(), 'yyyy-MM-dd', 'en')}`], 105, 17, {
          maxWidth: pdfWidth,
          align: 'center'
        });
        doc.addImage(img, 'PNG', bufferX, bufferY, pdfWidth, pdfHeight);
        return doc;

      }).then((doc) => {
        doc.save('Tasks Insights ' + formatDate(new Date(), 'yyyy-MM-dd', 'en') + '.pdf');
        this.projectInsightsComponent.isLoading = false;
      });
    }
  }
}
