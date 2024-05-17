import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnDestroy,
  OnInit
} from '@angular/core';
import {IMemberAllocation} from "@interfaces/schedular";
import moment from "moment/moment";
import {SchedulerCommonService} from "../../../service/scheduler-common.service";
import {ProjectScheduleService} from "../../service/project-schedule-service.service";
import {Moment} from "moment";
import {Socket} from "ngx-socket-io";
import {SocketEvents} from "@shared/socket-events";

@Component({
  selector: 'worklenz-member-indicator',
  templateUrl: './member-indicator.component.html',
  styleUrls: ['./member-indicator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberIndicatorComponent implements OnInit, OnDestroy {
  @Input({required: true}) teamMemberId: string | null = null;
  @Input({required: true}) projectId: string | null = null;
  @Input({required: true}) allocation: IMemberAllocation | null = null;

  isResized = false;

  constructor(
    private readonly service: ProjectScheduleService,
    private readonly common: SchedulerCommonService,
    private readonly cdr: ChangeDetectorRef,
    private readonly socket: Socket,
  ) {
  }

  @HostListener("contextmenu", ["$event"])
  private onContextMenu(event: MouseEvent) {
    if (this.allocation?.ids) this.service.emitOnContextMenu(event, this.projectId as string, this.teamMemberId as string, this.allocation.ids);
    this.cdr.markForCheck();
  }

  ngOnInit() {
    this.socket.on(SocketEvents.SCHEDULE_MEMBER_START_DATE_CHANGE.toString(), this.handleResponse);
    this.socket.on(SocketEvents.SCHEDULE_MEMBER_END_DATE_CHANGE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.SCHEDULE_MEMBER_START_DATE_CHANGE.toString(), this.handleResponse);
    this.socket.removeListener(SocketEvents.SCHEDULE_MEMBER_END_DATE_CHANGE.toString(), this.handleResponse);
  }

  private handleResponse = (response: { id: string; date: string }) => {
    const checkAvailablity = this.allocation?.ids.find(a => a === response.id);
    if (checkAvailablity) {

      if (moment(response.date).isSameOrAfter(this.common.endDate) || moment(response.date).isSameOrBefore(this.common.startDate)) {
        this.service.emitReload();
      } else {
        this.service.emitMemberIndicatorChange(this.projectId as string, this.teamMemberId as string);
      }
    }
  };


  onResizeStart(event: MouseEvent, allocation: IMemberAllocation, direction: 'left' | 'right', indicator: HTMLDivElement): void {
    if (!allocation || !allocation.indicator_width || !allocation.indicator_offset || event.button == 2) {
      return;
    }

    const startX = event.clientX;
    const startWidth = allocation.indicator_width;
    const startLeft = allocation.indicator_offset;
    const fChartStart = moment(this.common.startDate).format("YYYY-MM-DD");
    const chartStart = moment(fChartStart);

    indicator.style.zIndex = '11';

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;

      let newWidth = startWidth;
      let newLeft = startLeft;

      if (direction === 'left') {
        newWidth = startWidth - deltaX;
        newLeft = startLeft + deltaX;
      } else if (direction === 'right') {
        newWidth = startWidth + deltaX;
      }

      this.cdr.markForCheck();

      if (newWidth >= this.common.GANNT_COLUMN_WIDTH - 3) {
        allocation.indicator_width = newWidth;
        allocation.indicator_offset = newLeft;
        this.isResized = true;
        this.cdr.markForCheck();
      }
    };

    const onMouseUp = () => {

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (direction === 'left') {
        const diff = allocation.indicator_offset ? allocation.indicator_offset % this.common.GANNT_COLUMN_WIDTH : 0;
        const fromStart = allocation.indicator_offset ? (allocation.indicator_offset - diff) / this.common.GANNT_COLUMN_WIDTH : 0;
        const allocationStartDate = chartStart.add(fromStart, "days");

        this.changeAllocationStart(allocationStartDate)

      }
      if (direction === 'right') {
        const diff = allocation.indicator_width ? allocation.indicator_width % this.common.GANNT_COLUMN_WIDTH : 0;
        let allocationWidth = allocation.indicator_width;
        if (diff > 0) {
          allocationWidth = allocation.indicator_width ? allocation.indicator_width + (this.common.GANNT_COLUMN_WIDTH - diff) : 0;
        }
        if (!allocationWidth) return;

        const duration = allocation.indicator_offset ? (allocation.indicator_offset + allocationWidth) / this.common.GANNT_COLUMN_WIDTH : 0;
        const allocationEndDate = moment(fChartStart).add(duration - 1, "days")

        this.changeAllocationEnd(allocationEndDate);


      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  changeAllocationStart(startDate: Moment) {
    this.socket.emit(
      SocketEvents.SCHEDULE_MEMBER_START_DATE_CHANGE.toString(), JSON.stringify({
        project_id: this.projectId,
        team_member_is: this.teamMemberId,
        allocation_ids: this.allocation?.ids || [],
        allocated_from: startDate
      })
    )
  }

  changeAllocationEnd(endDate: Moment) {
    this.socket.emit(
      SocketEvents.SCHEDULE_MEMBER_END_DATE_CHANGE.toString(), JSON.stringify({
        project_id: this.projectId,
        team_member_is: this.teamMemberId,
        allocation_ids: this.allocation?.ids || [],
        allocated_to: endDate
      })
    )
  }

}
