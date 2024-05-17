import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ILocalSession} from "@interfaces/api-models/local-session";
import {Socket} from "ngx-socket-io";
import {AuthService} from "@services/auth.service";
import {ProjectScheduleService} from "../../service/project-schedule-service.service";
import {SchedulerCommonService} from "../../../service/scheduler-common.service";
import {SocketEvents} from "@shared/socket-events";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-add-member-allocation',
  templateUrl: './add-member-allocation.component.html',
  styleUrls: ['./add-member-allocation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddMemberAllocationComponent implements OnInit, OnDestroy {
  @Input({required: true}) projectId: string | null = null;
  @Input({required: true}) teamMemberId: string | null = null;

  left: number = 0;
  width: number = 0;

  private readonly _session: ILocalSession | null = null;

  constructor(
    private readonly socket: Socket,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ProjectScheduleService,
    private readonly common: SchedulerCommonService
  ) {
    this._session = this.auth.getCurrentSession();

    this.service.onResetAllocator.pipe(takeUntilDestroyed()).subscribe(() => {
      this.reset();
    })
  }

  ngOnInit() {
    this.socket.on(SocketEvents.SCHEDULE_MEMBER_ALLOCATION_CREATE.toString(), this.handleResponse);
  }

  ngOnDestroy() {
    this.socket.removeListener(SocketEvents.SCHEDULE_MEMBER_ALLOCATION_CREATE.toString(), this.handleResponse);
  }

  onDragStart(event: MouseEvent) {
    this.left = event.offsetX - (event.offsetX % 35);
    const pageX = event.pageX;
    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.pageX - pageX;
      requestAnimationFrame(() => {
        this.width = deltaX;
        this.service.highlighterWidth = this.width;
        this.service.highlighterLeft = this.left;
        this.cdr.markForCheck();
      });
    };
    const onMouseUp = (event: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (pageX > event.pageX) {
        this.width = 0;
        this.left = 0;
        this.cdr.markForCheck();
        return;
      }
      requestAnimationFrame(() => {
        this.width = this.width + (35 - (this.width % 35));
        this.service.highlighterWidth = this.width;
        this.service.highlighterLeft = this.left;
        this.createAllocation();
        this.cdr.markForCheck();
      })
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  createAllocation() {
    this.socket.emit(SocketEvents.SCHEDULE_MEMBER_ALLOCATION_CREATE.toString(), JSON.stringify({
      project_id: this.projectId,
      team_member_id: this.teamMemberId,
      offset: this.left,
      width: this.width,
      chart_start: this.common.startDate,
      time_zone: this._session?.timezone_name
    }));

  }

  private handleResponse = (response: { team_member_id: string; project_id: string }) => {
    if (this.teamMemberId === response.team_member_id && this.projectId === response.project_id) {
      this.service.emitMemberIndicatorChange(this.projectId as string, this.teamMemberId as string);
    }
  };

  private reset() {
    this.width = 0;
    this.left = 0;
    this.service.highlighterWidth = 0;
    this.service.highlighterLeft = 0;
    this.cdr.markForCheck();
  }
}
