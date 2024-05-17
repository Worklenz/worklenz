import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    HostBinding,
    Input,
    NgZone, OnDestroy, OnInit,
    Renderer2
} from '@angular/core';
import {Socket} from "ngx-socket-io";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ALPHA_CHANNEL} from "@shared/constants";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {ScheduleMemberTasksService} from "../../service/schedule-member-tasks-service.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {SocketEvents} from "@shared/socket-events";
import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {ITaskPhaseChangeResponse} from "@interfaces/task-phase-change-response";

@Component({
    selector: 'worklenz-schedule-phase',
    templateUrl: './phase.component.html',
    styleUrls: ['./phase.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PhaseComponent implements OnInit, OnDestroy{
    @Input({required: true}) task: IProjectTask = {};
    @HostBinding("class") cls = "flex-row task-phase";

    readonly PHASE_COLOR = "#a9a9a9" + ALPHA_CHANNEL;
    readonly PLACEHOLDER_COLOR = 'rgba(0, 0, 0, 0.85) !important';

    phases: ITaskPhase[] = [];

    loading = false;

    constructor(
        private readonly service: ScheduleMemberTasksService,
        private readonly socket: Socket,
        private readonly cdr: ChangeDetectorRef,
        private readonly ngZone: NgZone,
        private readonly element: ElementRef,
        private readonly renderer: Renderer2
    ) {
        this.service.onPhaseChange$
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
                this.updatePhases();
                this.cdr.markForCheck();
            });
    }

    ngOnInit() {
        this.updatePhases();
        this.socket.on(SocketEvents.TASK_PHASE_CHANGE.toString(), this.handleResponse);
    }

    ngOnDestroy() {
        this.socket.removeListener(SocketEvents.TASK_PHASE_CHANGE.toString(), this.handleResponse);
    }

    private isGroupByPhase() {
        return this.service.getCurrentGroup().value === this.service.GROUP_BY_PHASE_VALUE;
    }

    trackById(index: number, item: ITaskStatusViewModel) {
        return item.id;
    }

    handleChange(phaseId: string, taskId?: string) {
        if (!taskId) return;
        this.socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
            task_id: taskId,
            phase_id: phaseId,
            parent_task: this.task.parent_task_id
        });
    }

    private handleResponse = (response: ITaskPhaseChangeResponse) => {
        if (response && response.task_id === this.task.id) {
            this.task.phase_color = response.color_code || undefined;
            this.task.phase_id = response.id;

            if (this.isGroupByPhase()) {
                this.service.updateTaskGroup(this.task, false);
                if (this.service.isSubtasksIncluded) {
                    this.service.emitRefreshSubtasksIncluded();
                }
            }
            this.cdr.markForCheck();
        }
    }

    private updatePhases() {
        this.phases = this.service.phases;
    }

    toggleHighlightCls(active: boolean, element: HTMLElement) {
        this.ngZone.runOutsideAngular(() => {
            if (active) {
                this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
            } else {
                this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
            }
        });
    }

    handleOpen(open: boolean) {
        this.toggleHighlightCls(open, this.element.nativeElement);
    }


}
