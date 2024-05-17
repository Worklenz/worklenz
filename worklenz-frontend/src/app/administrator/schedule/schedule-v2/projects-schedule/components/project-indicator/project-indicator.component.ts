import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input} from '@angular/core';
import {IScheduleProject} from "@interfaces/schedular";
import {ProjectScheduleService} from "../../service/project-schedule-service.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-project-indicator',
  templateUrl: './project-indicator.component.html',
  styleUrls: ['./project-indicator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectIndicatorComponent {
  @Input({required: true}) project: IScheduleProject | null = null;

  constructor(
    private readonly service: ProjectScheduleService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.service.onProjectIndicatorChange.pipe(takeUntilDestroyed()).subscribe((response) => {
      if (this.project?.id === response.projectId) {
        this.project.indicator_offset = response.indicatorOffset;
        this.project.indicator_width = response.indicatorWidth;
        this.cdr.markForCheck();
      }
    }),
      this.service.onProjectToggle$.pipe(takeUntilDestroyed()).subscribe((response) => {
        if (this.project?.id === response) {
          this.cdr.markForCheck();
        }
      })
  }

}
