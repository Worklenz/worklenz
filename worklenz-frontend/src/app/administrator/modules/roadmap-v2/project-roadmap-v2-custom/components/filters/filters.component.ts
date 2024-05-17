import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  Output
} from '@angular/core';
import {IGroupByOption} from "../../../../task-list-v2/interfaces";
import {Socket} from "ngx-socket-io";
import {RoadmapV2Service} from "../../services/roadmap-v2-service.service";

@Component({
  selector: 'worklenz-filters',
  templateUrl: './filters.component.html',
  styleUrls: ['./filters.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FiltersComponent {
  @Input() projectId!: string;

  @Output() onGroupBy = new EventEmitter<IGroupByOption>();

  get selectedGroup() {
    return this.service.getCurrentGroup();
  }

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    public readonly service: RoadmapV2Service,
  ) {
  }

  changeGroup(item: IGroupByOption) {
    this.service.setCurrentGroup(item);
    this.onGroupBy.emit(item);
  }


  isGroupByPhase() {
    return this.selectedGroup.value === this.service.GROUP_BY_PHASE_VALUE;
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  reset() {
    this.ngZone.runOutsideAngular(() => {
      document.body.click();
    });
  }

}
