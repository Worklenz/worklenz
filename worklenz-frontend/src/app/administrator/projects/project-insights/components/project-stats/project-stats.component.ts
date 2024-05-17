import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
import {IProjectInsightsGetRequest} from "@interfaces/api-models/project-insights";
import {log_error} from "@shared/utils";
import {ProjectInsightsService} from "@api/project-insights.service";
import {ActivatedRoute} from "@angular/router";

@Component({
  selector: 'worklenz-project-stats',
  templateUrl: './project-stats.component.html',
  styleUrls: ['./project-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectStatsComponent implements OnInit, OnChanges {
  @Input() archived = false;

  private readonly includeArchivedTasks = "include-archived-tasks";

  loading = false;
  overviewData: IProjectInsightsGetRequest = {};
  projectId: string = '';

  constructor(
    private api: ProjectInsightsService,
    private route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
  }

  ngOnInit() {
    // this.getProjectOverviewData();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.getProjectOverviewData();
  }

  get archivedTasksChoice() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  async getProjectOverviewData() {
    try {
      this.loading = true;
      const res = await this.api.getProjectOverviewData(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.overviewData = res.body;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  checkOverLoggedOrNot(overviewData: IProjectInsightsGetRequest) {
    if (overviewData.total_estimated_hours === null || overviewData.total_logged_hours === null) return false;
    return (overviewData.total_estimated_hours || 0) < (overviewData.total_logged_hours || 0);
  }

}
