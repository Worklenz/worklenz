import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    NgZone,
    Output,
    Renderer2
} from '@angular/core';
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {Socket} from "ngx-socket-io";
import {UtilsService} from "@services/utils.service";
import {TaskStatusesApiService} from "@api/task-statuses-api.service";
import {TaskPrioritiesService} from "@api/task-priorities.service";
import {TaskPhasesApiService} from "@api/task-phases-api.service";
import {TaskViewService} from "@admin/components/task-view/task-view.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ScheduleMemberTasksHashmapService} from "../../service/schedule-member-tasks-hashmap-service.service";
import {ScheduleMemberTasksService} from "../../service/schedule-member-tasks-service.service";
import {IMemberTaskListGroup, IScheduleProjectMember, IScheduleTasksConfig} from "@interfaces/schedular";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {deepClone} from "@shared/utils";
import {AvatarNamesMap} from "@shared/constants";
import {ScheduleApiService} from "@api/schedule-api.service";
import {IGroupByOption} from "../../../../../modules/task-list-v2/interfaces";
import {ProjectsService} from "../../../../../projects/projects.service";

@Component({
    selector: 'worklenz-schedule-project-member-tasks-drawer',
    templateUrl: './project-member-tasks-drawer.component.html',
    styleUrls: ['./project-member-tasks-drawer.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectMemberTasksDrawerComponent {
    private _show = false;
    get show(): boolean {
        return this._show;
    }

    @Input() set show(value: boolean) {
        if (value === this._show) return;
        this._show = value;
    }

    @Input({required: true}) teamMember: IScheduleProjectMember | null = null;
    @Input({required: true}) projectId: string | null = null;
    @Output() showChange: EventEmitter<boolean> = new EventEmitter<boolean>();
    @Output() onOpenTask = new EventEmitter<IProjectTask>();

    private readonly DRAWER_CLOSE_TIME = 100;

    readonly BODY_STYLE = {
        padding: 0,
        overflowX: 'hidden',
        overflowY: 'auto'
    };

    loading = false;
    protected loadingGroups = false;
    protected loadingStatuses = false;
    protected loadingPriorities = false;
    protected loadingPhases = false;
    protected loadingCategories = false;

    protected groupIds: string[] = [];

    protected selectedTask: IProjectTask | null = null;
    protected categories: ITaskStatusCategory[] = [];

    protected get groups() {
        return this.service.groups;
    }

    get selectedGroup() {
        return this.service.getCurrentGroup();
    }

    constructor(
        private readonly cdr: ChangeDetectorRef,
        private readonly api: ScheduleApiService,
        private readonly ngZone: NgZone,
        private readonly map: ScheduleMemberTasksHashmapService,
        private readonly socket: Socket,
        private readonly renderer: Renderer2,
        public readonly service: ScheduleMemberTasksService,
        public readonly utils: UtilsService,
        private readonly statusesApi: TaskStatusesApiService,
        private readonly prioritiesApi: TaskPrioritiesService,
        private readonly phasesApi: TaskPhasesApiService,
        private readonly taskViewService: TaskViewService,
        private readonly projectService: ProjectsService
    ) {

        this.taskViewService.onSingleMemberChange.pipe(takeUntilDestroyed())
            .subscribe(async (teamMemberId: string) => {
                if (teamMemberId === this.teamMember?.team_member_id) {
                    await this.getGroups(false);
                }
                this.cdr.markForCheck();
            });

        this.taskViewService.onDelete
            .pipe(takeUntilDestroyed())
            .subscribe(async task => {
                this.init();
            })

        this.service.onRemoveMembersTask.pipe(takeUntilDestroyed()).subscribe((taskId: string) => {
            this.service.deleteTask(taskId);
        })

    }

    private init() {
        this.service.isSubtasksIncluded = true;
        void Promise.all([
            this.getGroups(true),
            this.getStatuses(),
            this.getPriorities(),
            this.getCategories(),
            this.getPhases()
        ])
        ;
    }

    private getConf(parentTaskId?: string): IScheduleTasksConfig {
        const config: IScheduleTasksConfig = {
            id: this.projectId as string,
            members: this.teamMember?.team_member_id as string,
            archived: false,
            group: this.service.getCurrentGroup().value,
            isSubtasksInclude: false,
        };

        if (parentTaskId)
            config.parent_task = parentTaskId;

        return config;
    }

    private async getGroups(loading = true) {
        if (!this.projectId || !this.teamMember?.team_member_id) return;
        try {
            this.map.deselectAll();
            this.loadingGroups = loading;
            const config = this.getConf();
            config.isSubtasksInclude = this.service.isSubtasksIncluded;
            const res = await this.api.getTasksByMember(config) as IServerResponse<IMemberTaskListGroup[]>;
            if (res.done) {
                const groups = deepClone(res.body);
                this.groupIds = groups.map((g: IMemberTaskListGroup) => g.id);
                this.mapTasks(groups);
                this.service.groups = groups;
            }
            this.loadingGroups = false;
        } catch (e) {
            this.loadingGroups = false;
        }
        this.cdr.markForCheck();
    }

    private mapTasks(groups: IMemberTaskListGroup[]) {
        for (const group of groups) {
            this.map.registerGroup(group);
            for (const task of group.tasks) {
                if (task.start_date) task.start_date = new Date(task.start_date) as any;
                if (task.end_date) task.end_date = new Date(task.end_date) as any;
            }
        }
    }

    private async getStatuses() {
        if (!this.projectId) return;
        try {
            this.loadingStatuses = true;
            const res = await this.statusesApi.get(this.projectId);
            if (res.done)
                this.service.statuses = res.body;
            this.loadingStatuses = false;
        } catch (e) {
            this.loadingStatuses = false;
        }
    }

    private async getPriorities() {
        try {
            this.loadingPriorities = true;
            const res = await this.prioritiesApi.get();
            if (res.done)
                this.service.priorities = res.body;
            this.loadingPriorities = false;
        } catch (e) {
            this.loadingPriorities = false;
        }
    }

    private async getCategories() {
        try {
            this.loadingCategories = true;
            const res = await this.statusesApi.getCategories();
            if (res.done)
                this.categories = res.body;
            this.loadingCategories = false;
        } catch (e) {
            this.loadingCategories = false;
        }
    }

    private async getPhases() {
        if (!this.projectId) return;
        try {
            const res = await this.phasesApi.get(this.projectId);
            if (res.done)
                this.service.phases = res.body;
        } catch (e) {
        }
    }

    handleCancel() {
        if (this._show) {
            this._show = false;
            this.showChange.emit(this._show);
        }
    }

    onVisibilityChange(visible: boolean) {
        if (visible) {
            this.service.setCurrentGroup(this.service.GROUP_BY_OPTIONS[0]);
            setTimeout(() => this.init(), this.DRAWER_CLOSE_TIME);
        }
    }

    getColor(name?: string) {
        return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
    }

    protected trackById(index: number, item: any) {
        return item.id;
    }

    protected openTask(task: IProjectTask) {
        if(task.project_id) this.projectService.id = task.project_id;
        this.onOpenTask.emit(task)
        this.cdr.markForCheck();
    }

    async toggleCollapse(group: IMemberTaskListGroup | IProjectTask) {
        if (this.isTaskListGroup(group)) {
            group.isExpand = !group.isExpand;
        }
        this.cdr.detectChanges();
    }

    isTaskListGroup(group: IMemberTaskListGroup | IProjectTask): group is IMemberTaskListGroup {
        return (group as IMemberTaskListGroup).tasks !== undefined;
    }

    private toggleFocusCls(focused: boolean, element: HTMLElement) {
        if (focused) {
            this.renderer.addClass(element, this.service.HIGHLIGHT_COL_CLS);
        } else {
            this.renderer.removeClass(element, this.service.HIGHLIGHT_COL_CLS);
        }
    }

    changeGroup(item: IGroupByOption) {
        this.service.setCurrentGroup(item);
        this.init();
    }

    protected handleFocusChange(focused: boolean, element: HTMLElement) {
        this.ngZone.runOutsideAngular(() => {
            this.toggleFocusCls(focused, element);
        });
    }

    unuseFunc(e: any, row: any, group: any) {
        return;
    }
}
