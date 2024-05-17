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
import {ActivatedRoute} from "@angular/router";
import {log_error} from "@shared/utils";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {formatDistance} from "date-fns";
import {UtilsService} from "@services/utils.service";
import {IInsightTasks} from "@interfaces/api-models/project-insights";

@Component({
  selector: 'worklenz-last-updated-tasks',
  templateUrl: './last-updated-tasks.component.html',
  styleUrls: ['./last-updated-tasks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LastUpdatedTasksComponent implements OnInit, OnChanges {
  @Input() archived = false;

  private readonly includeArchivedTasks = "include-archived-tasks";

  loadingStatuses = false;
  loadingLastUpdatedTasks = false;

  showTaskDrawer = false;

  projectId: string = '';
  selectedTaskId: string | null = null;

  lastUpdatedTasks: IInsightTasks[] = [];

  constructor(
    private api: ProjectInsightsService,
    public utils: UtilsService,
    private socket: Socket,
    private route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
  }

  ngOnInit() {
    // this.getLastUpdatedTasks();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.getLastUpdatedTasks();
  }

  get archivedTasksChoice() {
    return localStorage.getItem(this.includeArchivedTasks) === 'true';
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString());
  }

  async getLastUpdatedTasks() {
    try {
      this.loadingLastUpdatedTasks = true;
      const res = await this.api.getLastUpdatedTasks(this.projectId, this.archivedTasksChoice);
      if (res.done) {
        this.lastUpdatedTasks = res.body;
      }
      this.loadingLastUpdatedTasks = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingLastUpdatedTasks = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  onCreateOrUpdate() {
    this.getLastUpdatedTasks();
    this.showTaskDrawer = false;
    this.selectedTaskId = null;
    this.cdr.markForCheck();
  }

  formatEndDate(updated_at: any) {
    return formatDistance(new Date(updated_at), new Date(), {addSuffix: true})
  }

  trackById(index: number, item: any) {
    return item.id;
  }
}
