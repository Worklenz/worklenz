import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnInit,
  SimpleChanges
} from '@angular/core';
import {ITeamMemberOverviewGetResponse} from "@interfaces/api-models/team-members-get-response";
import {IProjectsOverviewGetResponse} from "@interfaces/api-models/projects-get-response";
import {ActivatedRoute} from "@angular/router";
import {ProjectsApiService} from "@api/projects-api.service";
import {EventTaskCreatedOrUpdate} from "@shared/events";
import {animate, state, style, transition, trigger} from "@angular/animations";
import {ProjectInsightsService} from "@api/project-insights.service";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {Socket} from "ngx-socket-io";
import {UtilsService} from "@services/utils.service";

@Component({
  selector: 'worklenz-member-tasks',
  templateUrl: './member-tasks.component.html',
  styleUrls: ['./member-tasks.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberTasksComponent implements OnInit {
  @Input() archived = false;

  private readonly includeArchivedTasks = "include-archived-tasks";

  projectMembers: ITeamMemberOverviewGetResponse[] = [];

  projectId: string = '';
  projectOverview: IProjectsOverviewGetResponse = {};
  taskStatuses: ITaskStatusViewModel[] = [];

  completed = 0;
  pending = 0;

  loading = true;
  loadingTasks = true;
  loadingStatuses = false;

  expanded: { [key: string]: boolean } = {};

  constructor(
    private route: ActivatedRoute,
    private socket: Socket,
    public utils: UtilsService,
    private projectsApiService: ProjectsApiService,
    private projectInsightsService: ProjectInsightsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
  }

  ngOnInit(): void {
    // this.init();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.init();
    this.expanded = {};
  }

  get archivedTasksChoice() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  @HostListener(`document:${EventTaskCreatedOrUpdate}`)
  init() {
    this.getProjectOverview();
    this.getProjectOverviewMembers();
  }

  async getProjectOverview() {
    try {
      this.loading = true;
      const res = await this.projectsApiService.getOverViewById(this.projectId);
      if (res.done) {
        this.projectOverview = res.body;
        this.completed = this.projectOverview.done_task_count ? this.projectOverview.done_task_count : 0;
        this.pending = this.projectOverview.pending_task_count ? this.projectOverview.pending_task_count : 0;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async getProjectOverviewMembers() {
    try {
      this.loading = true;
      const res = await this.projectsApiService.getOverViewMembersById(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.projectMembers = res.body;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async getTasksByMember(member: ITeamMemberOverviewGetResponse) {
    try {
      this.loadingTasks = true;
      const res = await this.projectInsightsService.getMemberTasks({
        member_id: member.id,
        project_id: this.projectId,
        archived: this.archivedTasksChoice
      });
      if (res.done) {
        member.tasks = res.body;
      }
      this.loadingTasks = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingTasks = false;
      this.cdr.markForCheck();
    }
  }

  isRowClickable(rowData: ITeamMemberOverviewGetResponse): boolean {
    if (!rowData.task_count) return false;
    return rowData.task_count > 0
  }

  overdueTasksPresent(rowData: ITeamMemberOverviewGetResponse): boolean {
    if (!rowData.overdue_task_count) return false;
    return rowData.overdue_task_count > 0
  }

  rowClicked(member: ITeamMemberOverviewGetResponse) {
    if (!member.task_count) return;
    if (!this.expanded[member.id]) this.getTasksByMember(member);
    this.expanded[member.id] = !this.expanded[member.id];
    this.cdr.markForCheck();
  }

  trackById(index: number, item: any) {
    return item.id;
  }
}
