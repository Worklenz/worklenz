import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild
} from '@angular/core';
import {ProjectInsightsService} from "@api/project-insights.service";
import {ActivatedRoute, Router} from "@angular/router";
import {Socket} from "ngx-socket-io";
import {formatDistance} from "date-fns";

import {IProjectLogs} from "@interfaces/api-models/project-insights";
import {log_error} from "@shared/utils";
import {UtilsService} from "@services/utils.service";
import {TaskPrioritiesService} from "@api/task-priorities.service";
import {TaskStatusesApiService} from "@api/task-statuses-api.service";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {formatDate} from '@angular/common';
import {ProjectInsightsComponent} from '../project-insights.component';

@Component({
  selector: 'worklenz-project-overview',
  templateUrl: './project-overview.component.html',
  styleUrls: ['./project-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectOverviewComponent implements OnInit {
  @ViewChild('overviewExportDiv') overviewExportDiv: ElementRef | undefined;
  @Input() archived = false;

  private readonly includeArchivedTasks = "include-archived-tasks";

  loading = false;
  loadingProjectLogs = false;
  loadingCategories = false;

  projectId: string = '';

  projectLogs: IProjectLogs[] = [];
  categories: ITaskStatusCategory[] = [];

  toDoColorCode: string = '';
  pendingColorCode: string = '';
  completedColorCode: string = '';

  constructor(
    private api: ProjectInsightsService,
    private route: ActivatedRoute,
    private router: Router,
    private socket: Socket,
    public utils: UtilsService,
    private prioritiesApi: TaskPrioritiesService,
    private statusesApi: TaskStatusesApiService,
    private projectInsightsComponent: ProjectInsightsComponent,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
  }

  ngOnInit() {
    this.getCategories();
    this.getProjectLogs();
  }

  async getCategories() {
    try {
      this.loadingCategories = true;
      const res = await this.statusesApi.getCategories();
      if (res.done) {
        this.categories = res.body;
        this.toDoColorCode = this.categories.find(e => e.name === 'To do')?.color_code || '';
        this.pendingColorCode = this.categories.find(e => e.name === 'Doing')?.color_code || '';
        this.completedColorCode = this.categories.find(e => e.name === 'Done')?.color_code || '';
      }
      this.loadingCategories = false;
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e);
      this.loadingCategories = false;
      this.cdr.markForCheck();
    }
  }

  async getProjectLogs() {
    try {
      this.loadingProjectLogs = true;
      const res = await this.api.getProjectLogs(this.projectId);
      if (res.done) {
        this.projectLogs = res.body;
      }
      this.loadingProjectLogs = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingProjectLogs = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  formatEndDate(updated_at: any) {
    return formatDistance(new Date(updated_at), new Date(), {addSuffix: true})
  }

  goToList() {
    this.router.navigate([], {
      relativeTo: this.route, queryParams: {tab: "tasks-list"}, queryParamsHandling: 'merge', // remove to replace all query params by provided
    });
  }

  exportOverview(projectName: string | null) {
    if (this.overviewExportDiv) {

      this.projectInsightsComponent.isLoading = true;

      html2canvas(this.overviewExportDiv.nativeElement).then((canvas) => {

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
        doc.text([`Insights - ` + projectName + ` - Overview`, `${formatDate(new Date(), 'yyyy-MM-dd', 'en')}`], 105, 17, {
          maxWidth: pdfWidth,
          align: 'center'
        });
        doc.addImage(img, 'PNG', bufferX, bufferY, pdfWidth, pdfHeight);
        return doc;

      }).then((doc) => {
        doc.save('Overview ' + formatDate(new Date(), 'yyyy-MM-dd', 'en') + '.pdf');
        this.projectInsightsComponent.isLoading = false;
      });

      this.cdr.markForCheck();

    }

  }

}
