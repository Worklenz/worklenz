import {ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output} from '@angular/core';
import {IGroupByOption} from "../../../../modules/task-list-v2/interfaces";
import {PtTaskListService} from "../../services/pt-task-list.service";
import {TasksApiService} from "@api/tasks-api.service";
import {Socket} from "ngx-socket-io";
import {UtilsService} from "@services/utils.service";
import {ProjectPhasesService} from "@services/project-phases.service";
import {AuthService} from "@services/auth.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";

@Component({
  selector: 'worklenz-group-filter',
  templateUrl: './group-filter.component.html',
  styleUrls: ['./group-filter.component.scss']
})
export class GroupFilterComponent {
  @Input() templateId!: string;

  @Output() onGroupBy = new EventEmitter<IGroupByOption>();
  @Output() onFilterSearch = new EventEmitter<string | null>();
  @Output() onPhaseSettingsClick = new EventEmitter();
  @Output() onCreateStatusClick = new EventEmitter();

  readonly ASCEND = "ascend";
  readonly DESCEND = "descend";
  readonly COUNTS_LABELS_STYLE = {backgroundColor: '#1890ff', color: '#fff'};

  taskSearch: string | null = null;

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
    private readonly utils: UtilsService,
    private readonly phaseService: ProjectPhasesService,
    public readonly service: PtTaskListService,
    public readonly auth: AuthService
  ) {
  }

  changeGroup(item: IGroupByOption) {
    this.service.setCurrentGroup(item);
    this.onGroupBy.emit(item);
  }

  isGroupByStatus() {
    return this.selectedGroup.value === this.service.GROUP_BY_STATUS_VALUE;
  }

  isGroupByPhase() {
    return this.selectedGroup.value === this.service.GROUP_BY_PHASE_VALUE;
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  private toIdsMap(array: any[]) {
    return array.map(s => s.id).join("+");
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

  createStatusClick() {
    this.onCreateStatusClick?.emit();
  }

}
