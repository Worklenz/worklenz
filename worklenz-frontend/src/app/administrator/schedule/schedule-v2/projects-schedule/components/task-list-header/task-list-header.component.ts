import {ChangeDetectorRef, Component, EventEmitter, HostBinding, Input, Output} from '@angular/core';
import {TaskListV2Service} from "../../../../../modules/task-list-v2/task-list-v2.service";
import {ProjectPhasesService} from "@services/project-phases.service";
import {AuthService} from "@services/auth.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {merge} from "rxjs";
import {ScheduleMemberTasksHashmapService} from "../../service/schedule-member-tasks-hashmap-service.service";

@Component({
  selector: 'worklenz-schedule-task-list-header',
  templateUrl: './task-list-header.component.html',
  styleUrls: ['./task-list-header.component.scss']
})
export class TaskListHeaderComponent {
@HostBinding("class") headerCls = "d-flex header mb-0 flex-row";

  @Input() groupId!: string;
  @Output() selectChange = new EventEmitter<boolean>();

  checked = false;
  indeterminate = false;

  get phaseLabel() {
    return this.phasesService.label;
  }

  constructor(
    public readonly service: TaskListV2Service,
    private readonly map: ScheduleMemberTasksHashmapService,
    private readonly cdr: ChangeDetectorRef,
    private readonly phasesService: ProjectPhasesService,
    public readonly auth: AuthService
  ) {
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

  }

  onAllChecked(checked: boolean) {
    this.selectChange?.emit(checked);
  }
}
