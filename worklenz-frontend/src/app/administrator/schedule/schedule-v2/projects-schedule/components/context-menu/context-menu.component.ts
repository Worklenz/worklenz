import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, ViewChild} from '@angular/core';
import {ProjectScheduleService} from "../../service/project-schedule-service.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Subject} from "rxjs";
import {NzContextMenuService, NzDropdownMenuComponent} from "ng-zorro-antd/dropdown";
import {IMemberIndicatorContextMenuEvent} from "@interfaces/schedular";
import {ScheduleApiService} from "@api/schedule-api.service";
import {log_error} from "@shared/utils";

@Component({
  selector: 'worklenz-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContextMenuComponent implements OnDestroy {
  @ViewChild('contextMenuDropdown', {static: false}) contextMenuDropdown!: NzDropdownMenuComponent;

  private projectId: string | null = null;
  private teamMemberId: string | null = null;
  private idsToDelete: string[] = [];

  protected deleting = false;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly service: ProjectScheduleService,
    private readonly contextMenuService: NzContextMenuService,
    private readonly api: ScheduleApiService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.service.onContextMenu$.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.onContextMenu(value);
      this.cdr.markForCheck();
    })
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private onContextMenu(value: IMemberIndicatorContextMenuEvent) {
    this.idsToDelete = value.ids;
    this.projectId = value.projectId;
    this.teamMemberId = value.teamMemberId;
    this.contextMenuService.create(value.event, this.contextMenuDropdown);
    this.cdr.markForCheck();
  }

  async delete() {
    try {
      this.deleting = true;
      const res = await this.api.bulkDeleteMemberAllocations(this.idsToDelete);
      if (res.done) {
        this.service.emitMemberProjectIndicatorChange(this.projectId as string, this.teamMemberId as string, true);
        this.deleting = false;
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
      this.deleting = false;
      this.cdr.markForCheck();
    }
  }

}
