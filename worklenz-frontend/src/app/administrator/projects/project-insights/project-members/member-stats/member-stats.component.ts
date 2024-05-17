import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
import {ProjectInsightsService} from "@api/project-insights.service";
import {IProjectMemberStats} from "@interfaces/api-models/project-insights";
import {ActivatedRoute} from "@angular/router";

@Component({
  selector: 'worklenz-member-stats',
  templateUrl: './member-stats.component.html',
  styleUrls: ['./member-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberStatsComponent implements OnInit, OnChanges {
  @Input() archived = false;

  private readonly includeArchivedTasks = "include-archived-tasks";

  memberStats: IProjectMemberStats = {};
  projectId: string = '';

  loading = true;

  constructor(
    private api: ProjectInsightsService,
    private route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
  }

  ngOnInit() {
    // void this.getProjectMemberInsights();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.getProjectMemberInsights();
  }

  get archivedTasksChoice() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  async getProjectMemberInsights() {
    try {
      this.loading = true;
      const res = await this.api.getMemberInsightAStats(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.memberStats = res.body;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
