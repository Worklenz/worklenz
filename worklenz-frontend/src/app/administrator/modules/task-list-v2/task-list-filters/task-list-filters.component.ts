import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import {deepClone} from "@shared/utils";
import {
  IGroupByOption, IMembersFilterChange,
  ISelectableTaskStatus,
  ITaskListLabelFilter,
  ITaskListMemberFilter,
  ITaskListPriorityFilter,
  ITaskListSortableColumn
} from "../interfaces";
import {TaskListV2Service} from "../task-list-v2.service";
import {TasksApiService} from "@api/tasks-api.service";
import {SocketEvents} from "@shared/socket-events";
import {Socket} from "ngx-socket-io";
import {TaskLabelsApiService} from "@api/task-labels-api.service";
import {UtilsService} from "@services/utils.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ProjectPhasesService} from "@services/project-phases.service";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";
import {AuthService} from '@services/auth.service';
import {ProjectsService} from "../../../projects/projects.service";

@Component({
  selector: 'worklenz-task-list-filters',
  templateUrl: './task-list-filters.component.html',
  styleUrls: ['./task-list-filters.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListFiltersComponent implements OnInit, OnDestroy {
  @Input() projectId!: string;

  @Output() onGroupBy = new EventEmitter<IGroupByOption>();
  @Output() onFilterSortBy = new EventEmitter<string>();
  @Output() onFilterByPriority = new EventEmitter<string>();
  @Output() onFilterByLabel = new EventEmitter<string>();
  @Output() onFilterByMember = new EventEmitter<IMembersFilterChange>();
  @Output() onFilterSearch = new EventEmitter<string | null>();
  @Output() onPhaseSettingsClick = new EventEmitter();
  @Output() onStatusSettingsClick = new EventEmitter();

  readonly ASCEND = "ascend";
  readonly DESCEND = "descend";
  readonly COUNTS_LABELS_STYLE = {backgroundColor: '#1890ff', color: '#fff'};

  priorities: ITaskListPriorityFilter[] = [];
  labels: ITaskListLabelFilter[] = [];
  members: ITaskListMemberFilter[] = [];

  memberSearchText: string | null = null;
  labelsSearchText: string | null = null;
  taskSearch: string | null = null;

  sortFiltersActive = false;
  prioritiesFiltersActive = false
  labelsFiltersActive = false;
  membersFiltersActive = false;

  loadingAssignees = false;

  sortedColumnsCount = 0;
  selectedPrioritiesCount = 0;
  selectedLabelsCount = 0;
  selectedMembersCount = 0;

  statuses: ISelectableTaskStatus[] = [];

  readonly sortableColumns: ITaskListSortableColumn[] = [
    {label: "Task", key: "name", sort_order: this.ASCEND},
    {label: "Status", key: "status", sort_order: this.ASCEND},
    {label: "Priority", key: "priority", sort_order: this.ASCEND},
    {label: "Start Date", key: "start_date", sort_order: this.ASCEND},
    {label: "End Date", key: "end_date", sort_order: this.ASCEND},
    {label: "Completed Date", key: "completed_at", sort_order: this.ASCEND},
    {label: "Created Data", key: "created_at", sort_order: this.ASCEND},
    {label: "Last Updated", key: "updated_at", sort_order: this.ASCEND},
  ];

  get selectedGroup() {
    return this.service.getCurrentGroup();
  }

  get phaseLabel() {
    return this.phaseService.label;
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly tasksApi: TasksApiService,
    private readonly socket: Socket,
    private readonly labelsApi: TaskLabelsApiService,
    private readonly utils: UtilsService,
    private readonly phaseService: ProjectPhasesService,
    private readonly projectsService: ProjectsService,
    public readonly service: TaskListV2Service,
    public readonly auth: AuthService
  ) {
    this.service.onPrioritiesChange$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.priorities = deepClone(this.service.priorities);
        this.cdr.markForCheck();
      });
    this.phaseService.onLabelChange
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  ngOnInit() {
    void this.getMembers();
    void this.getLabels();
    this.socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.handleAssigneeResponse);
    this.socket.on(SocketEvents.TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.on(SocketEvents.CREATE_LABEL.toString(), this.handleLabelsChange);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), this.handleAssigneeResponse);
    this.socket.removeListener(SocketEvents.TASK_LABELS_CHANGE.toString(), this.handleLabelsChange);
    this.socket.removeListener(SocketEvents.CREATE_LABEL.toString(), this.handleLabelsChange);
  }

  private handleAssigneeResponse = () => {
    void this.getMembers();
  };

  private handleLabelsChange = () => {
    void this.getLabels();
  };

  changeGroup(item: IGroupByOption) {
    this.service.setCurrentGroup(item);
    this.onGroupBy.emit(item);
  }

  isGroupByPhase() {
    return this.selectedGroup.value === this.service.GROUP_BY_PHASE_VALUE;
  }

  isGroupByStatus() {
    return this.selectedGroup.value === this.service.GROUP_BY_STATUS_VALUE;
  }

  isProjectManager() {
    if (this.projectsService.projectOwnerTeamMemberId) return this.auth.getCurrentSession()?.team_member_id === this.projectsService.projectOwnerTeamMemberId;
    return false;
  }

  sortOrderCls(column: ITaskListSortableColumn) {
    return column.sort_order === this.ASCEND
      ? "sort-ascending"
      : "sort-descending";
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  private toIdsMap(array: any[]) {
    return array.map(s => s.id).join("+");
  }

  async getMembers() {
    if (!this.projectId) return;
    this.loadingAssignees = true;
    try {
      const res = await this.tasksApi.getTasksAssignees(this.projectId);
      if (res.done) {
        this.members = res.body;
      }
      this.loadingAssignees = false;
    } catch (e) {
      this.loadingAssignees = false;
    }
    this.cdr.markForCheck();
  }

  private async getLabels() {
    if (!this.projectId) return;
    try {
      const res = await this.labelsApi.getByProject(this.projectId);
      if (res.done) {
        this.labels = res.body;
      }
    } catch (e) {
      // ignored
    }
  }

  protected onSortOrderChange(column: ITaskListSortableColumn) {
    column.sort_order = column.sort_order === this.ASCEND ? this.DESCEND : this.ASCEND;
    if (column.selected)
      this.onSortFilterChange();
  }

  onSortFilterChange() {
    const selection = this.sortableColumns.filter(p => p.selected);
    this.sortFiltersActive = !!selection.length;
    this.sortedColumnsCount = selection.length;
    const filter = selection.map(s => `${s.key} ${s.sort_order}`).join(",");
    this.onFilterSortBy.emit(filter);
  }

  onPriorityFilterChange() {
    const selection = this.priorities.filter(p => p.selected);
    this.prioritiesFiltersActive = !!selection.length;
    this.selectedPrioritiesCount = selection.length;
    this.onFilterByPriority.emit(this.toIdsMap(selection));
  }

  onLabelsFilterChange() {
    const selection = this.labels.filter(l => l.selected);
    this.labelsFiltersActive = !!selection.length;
    this.selectedLabelsCount = selection.length;
    this.onFilterByLabel.emit(this.toIdsMap(selection));
    this.utils.sortBySelection(this.labels);
  }

  onMembersFilterChange() {
    const selection = this.members.filter(m => m.selected);
    this.membersFiltersActive = !!selection.length;
    this.selectedMembersCount = selection.length;

    // check whether selected members count
    if (this.selectedMembersCount > 0) {
      this.onFilterByMember.emit({
        selection: this.toIdsMap(selection),
        is_subtasks_included: true
      });
    } else {
      this.onFilterByMember.emit({
        selection: this.toIdsMap(selection),
        is_subtasks_included: false
      });
    }

    this.utils.sortBySelection(this.members);
  }

  search() {
    if (!this.taskSearch) return;
    this.onFilterSearch.emit(encodeURIComponent(this.taskSearch));
    // To close the search dropdown
    document.body.click();
  }

  reset() {
    if (!this.taskSearch) return;
    this.taskSearch = null;
    this.onFilterSearch.emit(this.taskSearch);
    this.ngZone.runOutsideAngular(() => {
      // To close the search dropdown
      document.body.click();
    });
  }

  onSearchDropdownVisibleChange(visible: boolean) {
    if (visible) {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          const input = document.querySelector("#task-search-input") as HTMLInputElement;
          input?.focus();
        }, DRAWER_ANIMATION_INTERVAL)
      });
    }
  }

  phaseSettingsClick() {
    this.onPhaseSettingsClick?.emit();

  }
  statusSettingsClick() {
    this.onStatusSettingsClick?.emit();
  }

}
