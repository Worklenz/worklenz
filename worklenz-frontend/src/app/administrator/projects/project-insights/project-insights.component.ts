import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, ViewChild} from '@angular/core';
import {
  ProjectInsightsMemberOverviewComponent
} from './project-members/project-insights-member-overview/project-insights-member-overview.component';
import {ProjectOverviewComponent} from './project-overview/project-overview.component';
import {TaskInsightsComponent} from './task-insights/task-insights.component';

enum IInsightModes {
  'overview', 'members', 'tasks'
}

@Component({
  selector: 'worklenz-project-insights',
  templateUrl: './project-insights.component.html',
  styleUrls: ['./project-insights.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectInsightsComponent {
  @ViewChild(ProjectOverviewComponent) projectOverviewComponent: ProjectOverviewComponent | undefined;
  @ViewChild(TaskInsightsComponent) taskInsightsComponent: TaskInsightsComponent | undefined;
  @ViewChild(ProjectInsightsMemberOverviewComponent) projectInsightsMemberOverviewComponent: ProjectInsightsMemberOverviewComponent | undefined;

  @Input() projectName: string | null = null;
  private readonly includeArchivedTasks = "include-archived-tasks";

  options = ['Overview', 'Members', 'Tasks'];
  selectedMode: number = IInsightModes.overview;
  modes = IInsightModes;
  isLoading = false;
  includeArchived = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.checkArchivedChoice();
  }

  get archived() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  checkArchivedChoice() {
    if (localStorage.getItem(this.includeArchivedTasks) === null) {
      localStorage.setItem(this.includeArchivedTasks, 'false');
    }
    this.includeArchived = this.archived;
    this.cdr.markForCheck();
  }

  handleIndexChange(e: number): void {
    this.selectedMode = e;
  }

  exportPdf() {
    if (this.selectedMode == 0) {
      this.projectOverviewComponent?.exportOverview(this.projectName);
      this.cdr.markForCheck();
    }
    if (this.selectedMode == 1) {
      this.projectInsightsMemberOverviewComponent?.exportMembersInsight(this.projectName);
      this.cdr.markForCheck();
    }
    if (this.selectedMode == 2) {
      this.taskInsightsComponent?.exportTaskInsights(this.projectName);
      this.cdr.markForCheck();
    }
  }

  archivedChoiceChanged(event: any) {
    localStorage.setItem(this.includeArchivedTasks, event);
    this.cdr.markForCheck();
  }
}
