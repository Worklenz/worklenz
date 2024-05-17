import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output
} from '@angular/core';
import {ProjectPhasesService} from "@services/project-phases.service";
import {AuthService} from "@services/auth.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {merge} from "rxjs";
import {PtTaskListService} from "../../services/pt-task-list.service";
import {PtTaskListHashMapService} from "../../services/pt-task-list-hash-map.service";

@Component({
  selector: 'worklenz-task-list-header',
  templateUrl: './task-list-header.component.html',
  styleUrls: ['./task-list-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListHeaderComponent {
@HostBinding("class") headerCls = "flex-table header";

  @Output() selectChange = new EventEmitter<boolean>();
  @Output() phaseSettingsClick = new EventEmitter<void>();

  @Input() groupId!: string;

  checked = false;
  indeterminate = false;

  get phaseLabel() {
    return this.phasesService.label;
  }

  constructor(
    public readonly service: PtTaskListService,
    private readonly map: PtTaskListHashMapService,
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

  onAllChecked(checked: boolean) {
    this.selectChange?.emit(checked);
  }

  protected onPhaseSettingsClick() {
    this.phaseSettingsClick.emit();
  }
}
