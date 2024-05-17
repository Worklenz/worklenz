import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {IRPTMember, IRPTOverviewProject, IRPTTasksDrawerData} from "../../interfaces";
import {ReportingDrawersService} from "../reporting-drawers.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {log_error} from "@shared/utils";
import {ReportingExportApiService} from "@api/reporting-export-api.service";

@Component({
  selector: 'worklenz-rpt-tasks-drawer',
  templateUrl: './rpt-tasks-drawer.component.html',
  styleUrls: ['./rpt-tasks-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RptTasksDrawerComponent {
  project: IRPTOverviewProject | null = null;
  member: IRPTMember | null = null;
  isMultiple = false;

  exporting = false;

  get show() {
    return !!(this.project && this.member);
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly drawer: ReportingDrawersService,
    private readonly exportApiService: ReportingExportApiService
  ) {
    this.drawer.onOpenTasks
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.open(value);
      });
  }

  close() {
    this.project = null;
    this.member = null;
  }

  private open(data: IRPTTasksDrawerData) {
    this.project = data.project;
    this.member = data.member;
    this.cdr.markForCheck();
  }

  async export() {
    if (!this.member) return;
    try {
      if (this.project) {
        this.exportApiService.exportFlatTasks(this.member.id, this.member.name, this.project.id, this.project?.name);
      } else {
        this.exportApiService.exportFlatTasks(this.member.id, this.member.name, null, null);
      }
    } catch (e) {
      log_error(e);
    }
  }

}
