import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';
import {IRPTMember, ISingleMemberLogs} from "../../../../interfaces";
import {ReportingApiService} from "../../../../reporting-api.service";
import {AuthService} from "@services/auth.service";
import {LogHeaderService} from "../service/log-header.service";
import {ReportingDrawersService} from "../../../reporting-drawers.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ReportingService} from "../../../../reporting.service";
import moment from "moment";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";
import {merge} from "rxjs";
import {TaskViewService} from "@admin/components/task-view/task-view.service";

@Component({
  selector: 'worklenz-single-member-time-logs',
  templateUrl: './single-member-time-logs.component.html',
  styleUrls: ['./single-member-time-logs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleMemberTimeLogsComponent implements OnInit {
  @Input({required: true}) member: IRPTMember | null = null;
  @Input() isDurationLabelSelected = true;

  loading = false;
  exporting = false;

  timeLogs: ISingleMemberLogs[] = []

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ReportingApiService,
    private readonly auth: AuthService,
    public readonly service: LogHeaderService,
    public readonly drawer: ReportingDrawersService,
    private readonly reportingService: ReportingService,
    private readonly taskView: TaskViewService,
  ) {
    this.reportingService.onDrawerDateRangeChange.pipe(takeUntilDestroyed()).subscribe(async () => {
      await this.getTimeLogs();
    });

    this.reportingService.onDrawerDurationChange.pipe(takeUntilDestroyed()).subscribe(async () => {
      await this.getTimeLogs();
    });

    merge(
      this.taskView.onRefresh
    ).pipe(takeUntilDestroyed())
      .subscribe(async () => {
        await this.getTimeLogs();
      });

  }

  async ngOnInit() {
    await this.getTimeLogs();
  }

  private async setDatesForKeys() {
    if (this.reportingService.getDrawerDuration()?.key) {
      const key = this.reportingService.getDrawerDuration()?.key;
      const today = moment();

      switch (key) {
        case YESTERDAY:
          const yesterday = moment().subtract(1, "days");
          this.reportingService.setDrawerDateRange([yesterday.toString(), yesterday.toString()]);
          break;
        case LAST_WEEK:
          const lastWeekStart = moment().subtract(1, "weeks");
          this.reportingService.setDrawerDateRange([lastWeekStart.toString(), today.toString()]);
          break;
        case LAST_MONTH:
          const lastMonthStart = moment().subtract(1, "months");
          this.reportingService.setDrawerDateRange([lastMonthStart.toString(), today.toString()]);
          break;
        case LAST_QUARTER:
          const lastQuaterStart = moment().subtract(3, "months");
          this.reportingService.setDrawerDateRange([lastQuaterStart.toString(), today.toString()]);
          break;
        case PREV_WEEK:
          const prevWeekStart = moment().subtract(1, "weeks").startOf("week");
          const prevWeekEnd = moment().subtract(1, "weeks").endOf("week");
          this.reportingService.setDrawerDateRange([prevWeekStart.toString(), prevWeekEnd.toString()]);
          break;
        case PREV_MONTH:
          const prevMonthStart = moment().subtract(1, "month").startOf("month");
          const prevMonthEnd = moment().subtract(1, "month").endOf("month");
          this.reportingService.setDrawerDateRange([prevMonthStart.toString(), prevMonthEnd.toString()]);
          break;
      }
    }
  }

  public async getTimeLogs() {
    if (!this.member) return;

    try {
      this.loading = true;
      const teamId = this.auth.getCurrentSession()?.team_id;


      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }

      const body = {
        team_member_id: this.member.id,
        team_id: teamId as string,
        duration: this.reportingService.getDrawerDuration()?.key,
        date_range: this.reportingService.getDrawerDateRange(),
        archived: this.reportingService.getIncludeToggle()
      }
      const res = await this.api.getSingleMemberTimeLogs(body);
      if (res.done) {

        res.body.sort((a, b) => {
          const dateA = new Date(a.log_day);
          const dateB = new Date(b.log_day);
          return dateB.getTime() - dateA.getTime();
        });

        this.timeLogs = res.body;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  openTask(taskId: string, projectId: string) {
    if (taskId && projectId)
      this.drawer.openTask({taskId: taskId, projectId: projectId});
  }


}
