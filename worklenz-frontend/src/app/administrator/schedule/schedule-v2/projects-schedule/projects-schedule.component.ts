import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild
} from '@angular/core';
import {IScheduleProject, IScheduleProjectMember, IScheduleSingleMonth} from "@interfaces/schedular";
import {log_error} from "@shared/utils";
import {ScheduleApiService} from "@api/schedule-api.service";
import {ILocalSession} from "@interfaces/api-models/local-session";
import {AuthService} from "@services/auth.service";
import {AvatarNamesMap} from "@shared/constants";
import {ProjectScheduleService} from "./service/project-schedule-service.service";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ProjectsService} from "../../../projects/projects.service";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {Socket} from "ngx-socket-io";
import {SchedulerCommonService} from "../service/scheduler-common.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-projects-schedule',
  templateUrl: './projects-schedule.component.html',
  styleUrls: ['./projects-schedule.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsScheduleComponent implements OnInit {
  @ViewChild('scroller') scroller?: ElementRef;
  @ViewChild('fixed_right_column') fixed_right_column?: ElementRef;
  @ViewChild('fixed_left_column') fixed_left_column?: ElementRef;

  loading = false
  innerLoading = false;

  protected readonly Number = Number;
  protected showTaskModal = false;
  protected showMemberModal = false;
  protected selectedTaskId: string | null = null;
  protected selectedTeamMember: IScheduleProjectMember | null = null;
  protected selectedProjectId: string | null = null;

  initialScroll = 0;
  numberOfDays: number = 0;

  projectId: string | null = null;
  chartStart: string | null = null;
  chartEnd: string | null = null;

  selectedTask: IProjectTask | null = null;
  private session: ILocalSession | null = null;

  months: IScheduleSingleMonth[] = [];
  projects: IScheduleProject[] = [];

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  constructor(
    private readonly socket: Socket,
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ScheduleApiService,
    private readonly auth: AuthService,
    private readonly ngZone: NgZone,
    public service: ProjectScheduleService,
    public common: SchedulerCommonService,
    private readonly projectService: ProjectsService,
    private readonly taskViewService: TaskViewService
  ) {
    this.session = this.auth.getCurrentSession();

    this.common.onScrollToDate.pipe(takeUntilDestroyed()).subscribe((scrollAmount) => {
      this.scrollToDate(scrollAmount);
    })

    this.service.onMemberIndicatorChange.pipe(takeUntilDestroyed()).subscribe((body) => {
      void this.getMemberAllocation(body.projectId, body.teamMemberId)
    });

    this.service.onMemberProjectIndicatorChange.pipe(takeUntilDestroyed()).subscribe((body) => {
      void this.getMemberProjectAllocation(body.projectId, body.teamMemberId, body.isProjectRefresh);
    });

    this.service.onReload.pipe(takeUntilDestroyed()).subscribe(() => {
      void this.init(true);
    })

  }

  async ngOnInit() {
    await this.init(true);
  }

  async init(loading: boolean) {
    await this.createChartDates(loading);
    await this.getProjects();
    setTimeout(() => {
      this.scrollToDate(this.initialScroll - (this.common.GANNT_COLUMN_WIDTH * 2));
    }, 125)
  }

  async createChartDates(loading: boolean) {
    if (!this.session?.team_id) return;
    const timeZone = this.session?.timezone_name ? this.session.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      this.loading = loading;
      const res = await this.api.getGanttDates(this.session.team_id, timeZone)
      if (res.done) {
        this.months = res.body.date_data;
        this.numberOfDays = res.body.width;
        this.initialScroll = res.body.scroll_by;
        this.chartStart = res.body.chart_start;
        this.chartEnd = res.body.chart_end;
        this.common.startDate = res.body.chart_start;
        this.common.endDate = res.body.chart_end;
      }
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  async getProjects() {
    if (!this.session?.team_id) return;
    const timeZone = this.session?.timezone_name ? this.session.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const res = await this.api.getProjects(this.session.team_id, timeZone)
      if (res.done) {
        this.service.projects = res.body;
      }
      this.loading = false;
      await this.scrollListner();
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async getMemberAllocation(projectId: string, teamMemberId: string) {
    if (!projectId || !teamMemberId) return;
    const timeZone = this.session?.timezone_name ? this.session.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const res = await this.api.getMemberAllocation(projectId, teamMemberId, timeZone, false);
      if (res.done) {
        this.service.updateMemberAllocation(projectId, teamMemberId, res.body);
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e)
    }
  }

  async getMemberProjectAllocation(projectId: string, teamMemberId: string, isProjectRefresh: boolean) {
    if (!projectId || !teamMemberId) return;

    const timeZone = this.session?.timezone_name ? this.session.timezone_name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const res = await this.api.getMemberProjectAllocation(projectId, teamMemberId, timeZone, isProjectRefresh);
      if (res.done) {
        this.service.updateMemberAllocation(projectId, teamMemberId, res.body);
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e)
    }
  }

  async scrollListner() {
    this.ngZone.runOutsideAngular(() => {
      this.fixed_left_column?.nativeElement.addEventListener('scroll', () => {
        if (this.fixed_right_column) this.fixed_right_column.nativeElement.scrollTop = this.fixed_left_column?.nativeElement.scrollTop;
      });
      this.fixed_right_column?.nativeElement.addEventListener('scroll', () => {
        if (this.fixed_left_column) this.fixed_left_column.nativeElement.scrollTop = this.fixed_right_column?.nativeElement.scrollTop;
      });
    })
  }

  scrollToDate = (scrollAmount: number) => {
    this.ngZone.runOutsideAngular(() => {
      if (this.fixed_right_column) {
        this.fixed_right_column.nativeElement.classList.add('scroll-animation');
        this.fixed_right_column.nativeElement.scrollLeft = scrollAmount;
        setTimeout(() => {
          this.fixed_right_column?.nativeElement.classList.remove('scroll-animation');
          void this.scrollListner();
        }, 125)
      }
      this.cdr.markForCheck();
    })
  }

  toggleProject(project: IScheduleProject) {
    if (!project) return;
    this.service.toggleProject(project.id)
  }

  onShowChange(show: boolean) {
    if (!show) {
      this.selectedTask = null;
      this.cdr.markForCheck();
    }
  }

  protected openMember(member: IScheduleProjectMember, projectId: string) {
    if (member.pending_invitation) return;
    this.selectedProjectId = projectId
    this.selectedTeamMember = member;
    this.showMemberModal = true;
    this.cdr.markForCheck();
  }

  protected openTask(task: IProjectTask) {
    this.selectedTask = task;
    this.showTaskModal = true;
    this.cdr.markForCheck();
  }

}
