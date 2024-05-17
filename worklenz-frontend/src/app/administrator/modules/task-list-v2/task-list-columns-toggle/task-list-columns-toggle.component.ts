import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';
import {TasksApiService} from "@api/tasks-api.service";
import {ITaskListColumn} from "@interfaces/task-list-column";
import {TaskListV2Service} from "../task-list-v2.service";
import {ProjectPhasesService} from "@services/project-phases.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-task-list-columns-toggle',
  templateUrl: './task-list-columns-toggle.component.html',
  styleUrls: ['./task-list-columns-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListColumnsToggleComponent implements OnInit {
  @Input() projectId!: string;

  protected loading = false;

  constructor(
    public readonly service: TaskListV2Service,
    private readonly api: TasksApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly phasesService: ProjectPhasesService
  ) {
    this.phasesService.onLabelChange
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.getColumns();
      });
  }

  ngOnInit() {
    void this.getColumns();
  }

  private async getColumns() {
    if (!this.projectId) return;
    try {
      this.loading = true;
      const res = await this.api.getListCols(this.projectId);
      if (res.done) {
        this.service.columns = [...res.body];
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.detectChanges();
  }

  protected async onColumnsToggle(checked: boolean, item: ITaskListColumn) {
    if (!this.projectId) return;
    try {
      item.pinned = checked;
      this.service.emitColsChange();
      void this.api.toggleListCols(this.projectId, item);
    } catch (e) {
      // ignored
    }
  }
}
