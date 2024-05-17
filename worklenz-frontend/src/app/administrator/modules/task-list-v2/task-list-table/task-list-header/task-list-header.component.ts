import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnInit,
  Output
} from '@angular/core';
import {merge} from "rxjs";

import {TaskListV2Service} from "../../task-list-v2.service";
import {TaskListHashMapService} from "../../task-list-hash-map.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ProjectPhasesService} from "@services/project-phases.service";
import {AuthService} from "@services/auth.service";
import {ProjectsService} from "../../../../projects/projects.service";

@Component({
  selector: 'worklenz-task-list-header',
  templateUrl: './task-list-header.component.html',
  styleUrls: ['./task-list-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListHeaderComponent implements OnInit {
  @HostBinding("class") headerCls = "flex-table header";

  @Output() selectChange = new EventEmitter<boolean>();
  @Output() phaseSettingsClick = new EventEmitter<void>();

  @Input() groupId!: string;

  checked = false;
  indeterminate = false;

  keyActive = false;
  descriptionActive = false;
  progressActive = false;
  assigneesActive = false;
  labelsActive = false;
  statusActive = false;
  priorityActive = false;
  timeTrackingActive = false;
  estimationActive = false;
  startDateActive = false;
  dueDateActive = false;
  completedDateActive = false;
  createdDateActive = false;
  lastUpdatedActive = false;
  reporterActive = false;
  phaseActive = false;

  get phaseLabel() {
    return this.phasesService.label;
  }

  constructor(
    public readonly service: TaskListV2Service,
    private readonly map: TaskListHashMapService,
    private readonly cdr: ChangeDetectorRef,
    private readonly phasesService: ProjectPhasesService,
    public readonly auth: AuthService,
    private readonly projectsService: ProjectsService
  ) {
    this.service.onColumnsChange$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.cdr.markForCheck();
        this.updateState();
      });

    this.map.onDeselectAll$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.checked = false;
        this.indeterminate = false;
        this.cdr.markForCheck();
      });

    this.phasesService.onLabelChange
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.cdr.markForCheck();
      });

    merge(this.map.onSelect$, this.map.onDeselect$)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.map.isAllDeselected(this.groupId)) {
          this.checked = false;
          this.indeterminate = false;
        } else if (this.map.isAllSelected(this.groupId)) {
          this.checked = true;
          this.indeterminate = false;
        } else {
          this.indeterminate = true;
        }

        this.cdr.markForCheck();
      });
  }

  ngOnInit() {
    this.updateState();
  }

  isProjectManager() {
    if (this.projectsService.projectOwnerTeamMemberId) return this.auth.getCurrentSession()?.team_member_id === this.projectsService.projectOwnerTeamMemberId;
    return false;
  }

  private updateState() {
    this.keyActive = this.active(this.service.COLUMN_KEYS.KEY);
    this.descriptionActive = this.active(this.service.COLUMN_KEYS.DESCRIPTION);
    this.progressActive = this.active(this.service.COLUMN_KEYS.PROGRESS);
    this.assigneesActive = this.active(this.service.COLUMN_KEYS.ASSIGNEES);
    this.labelsActive = this.active(this.service.COLUMN_KEYS.LABELS);
    this.statusActive = this.active(this.service.COLUMN_KEYS.STATUS);
    this.priorityActive = this.active(this.service.COLUMN_KEYS.PRIORITY);
    this.timeTrackingActive = this.active(this.service.COLUMN_KEYS.TIME_TRACKING);
    this.estimationActive = this.active(this.service.COLUMN_KEYS.ESTIMATION);
    this.startDateActive = this.active(this.service.COLUMN_KEYS.START_DATE);
    this.dueDateActive = this.active(this.service.COLUMN_KEYS.DUE_DATE);
    this.completedDateActive = this.active(this.service.COLUMN_KEYS.COMPLETED_DATE);
    this.createdDateActive = this.active(this.service.COLUMN_KEYS.CREATED_DATE);
    this.lastUpdatedActive = this.active(this.service.COLUMN_KEYS.LAST_UPDATED);
    this.reporterActive = this.active(this.service.COLUMN_KEYS.REPORTER);
    this.phaseActive = this.active(this.service.COLUMN_KEYS.PHASE);
  }

  private active(key: string) {
    return this.service.canActive(key);
  }

  onAllChecked(checked: boolean) {
    this.selectChange?.emit(checked);
  }

  protected onPhaseSettingsClick() {
    this.phaseSettingsClick.emit();
  }
}
