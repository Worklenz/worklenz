import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnInit,
  Output
} from '@angular/core';
import {ITaskListGroup} from "../../interfaces";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {calculateTaskCompleteRatio, log_error} from "@shared/utils";
import {TaskStatusesApiService} from "@api/task-statuses-api.service";
import {ALPHA_CHANNEL, UNMAPPED} from "@shared/constants";
import {TaskListV2Service} from "../../task-list-v2.service";
import {ITaskStatusUpdateModel} from "@interfaces/api-models/task-status-update-model";
import {AuthService} from "@services/auth.service";
import {merge} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {TaskPhasesApiService} from "@api/task-phases-api.service";
import {ProjectsService} from "../../../../projects/projects.service";

@Component({
  selector: 'worklenz-task-list-group-settings',
  templateUrl: './task-list-group-settings.component.html',
  styleUrls: ['./task-list-group-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListGroupSettingsComponent implements OnInit {
  @Input() group!: ITaskListGroup;
  @Input() projectId: string | null = null;
  @Input() categories: ITaskStatusCategory[] = [];
  @Output() toggle = new EventEmitter<MouseEvent>();

  protected edit = false;
  protected isEditColProgress = false;
  protected showMenu = false;
  protected isGroupByStatus = false;
  protected isGroupByPhases = false;
  protected isAdmin = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly statusApi: TaskStatusesApiService,
    private readonly list: TaskListV2Service,
    private readonly ngZone: NgZone,
    private readonly phaseApi: TaskPhasesApiService,
    private readonly projectsService: ProjectsService
  ) {
    merge(
      this.list.onGroupProgressChangeDone$,
      this.list.onGroupChange$,
      this.list.onTaskAddOrDelete$
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.handleGroupProgressChange();
      });
  }

  ngOnInit() {
    this.isGroupByStatus = this.list.getCurrentGroup().value === this.list.GROUP_BY_STATUS_VALUE;
    this.isGroupByPhases = this.list.getCurrentGroup().value === this.list.GROUP_BY_PHASE_VALUE;
    const session = this.auth.getCurrentSession();
    if (session)
      this.isAdmin = !!(session.owner || session.is_admin);
  }

  canDisplayActions() {
    const currentGroup = this.list.getCurrentGroup().value;
    if (currentGroup === this.list.GROUP_BY_PRIORITY_VALUE) return false;
    return (this.isAdmin || this.isGroupByStatus || currentGroup === this.list.GROUP_BY_PHASE_VALUE) && this.group.name !== UNMAPPED;
  }

  isProgressBarAvailable() {
    return !this.isGroupByStatus;
  }

  private handleGroupProgressChange = () => {
    const group = this.group;
    if (!group) return;

    const todoCount = group.tasks.filter(t => t.status_category?.is_todo).length;
    const doingCount = group.tasks.filter(t => t.status_category?.is_doing).length;
    const doneCount = group.tasks.filter(t => t.status_category?.is_done).length;

    const total = group.tasks.length;

    group.todo_progress = calculateTaskCompleteRatio(todoCount, total);
    group.doing_progress = calculateTaskCompleteRatio(doingCount, total);
    group.done_progress = calculateTaskCompleteRatio(doneCount, total);
    this.cdr.markForCheck();
  }

  protected async changeStatusCategory(group: ITaskListGroup, categoryId?: string) {
    if (!categoryId) return;
    group.category_id = categoryId;
    await this.onBlurEditColumn(group);
    this.list.emitRefresh();
  }

  protected editGroupName() {
    this.edit = true;
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        const selector = `#group-name-${this.group.id}`;
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      });
    });
  }

  protected onToggleClick($event: MouseEvent) {
    if (this.edit) return;
    this.toggle.emit($event);
  }

  protected async onBlurEditColumn(group: ITaskListGroup) {
    if (!this.projectId || this.isEditColProgress) return;

    try {
      this.isEditColProgress = true;
      const groupBy = this.list.getCurrentGroup().value;
      if (groupBy === this.list.GROUP_BY_STATUS_VALUE) {
        await this.update(group);
      } else if (groupBy === this.list.GROUP_BY_PHASE_VALUE) {
        await this.updatePhase(group);
      }
      this.isEditColProgress = false;
      this.edit = false;
    } catch (e) {
      log_error(e);
      this.isEditColProgress = false;
    }

    this.cdr.markForCheck();
  }

  protected async updateName(group: ITaskListGroup) {
    if (!this.projectId || this.isEditColProgress) return;

    try {
      this.isEditColProgress = true;
      const groupBy = this.list.getCurrentGroup().value;
      if (groupBy === this.list.GROUP_BY_STATUS_VALUE) {
        await this.updateGroupName(group);
      } else if (groupBy === this.list.GROUP_BY_PHASE_VALUE) {
        await this.updatePhase(group);
      }
      this.isEditColProgress = false;
      this.edit = false;
    } catch (e) {
      log_error(e);
      this.isEditColProgress = false;
    }

    this.cdr.markForCheck();
  }

  private async updateGroupName(group: ITaskListGroup) {
    if (!group?.id || !this.projectId) return;
    try {
      const body = {
        name: group.name,
        project_id: this.projectId,
        category_id: group.category_id
      };
      const res = await this.statusApi.updateName(group.id, body, this.projectId as string);
      if (res.done) {
        const groups = this.list.groups;
        const group = groups.find(p => p.id === res.body.id);
        if (group) {
          this.group.name = group.name = res.body.name || '';
          this.group.color_code = group.color_code = res.body.color_code || '';
        }
        this.list.groups = groups;
      }
    } catch (e) {
      // ignored
    }

    this.cdr.markForCheck();
  }

  private async updatePhase(group: ITaskListGroup) {
    if (!group?.id || !this.projectId) return;
    if (!this.isAdmin && !this.isProjectManager()) return;
    try {
      const body = {
        id: group.id,
        name: group.name
      };
      const res = await this.phaseApi.update(this.projectId, body as ITaskPhase);
      if (res.done) {
        const phases = this.list.phases;
        const phase = phases.find(p => p.id === res.body.id);
        if (phase) {
          this.group.name = phase.name = res.body.name;
        }
        this.list.phases = phases;
      }
    } catch (e) {
      // ignored
    }

    this.cdr.markForCheck();
  }

  isProjectManager() {
    if (this.projectsService.projectOwnerTeamMemberId) return this.auth.getCurrentSession()?.team_member_id === this.projectsService.projectOwnerTeamMemberId;
    return false;
  }

  private async update(group: ITaskListGroup) {
    if (!this.isAdmin && !this.isProjectManager()) return;
    const body: ITaskStatusUpdateModel = {
      name: group.name,
      project_id: this.projectId as string,
      category_id: group.category_id
    };
    const res = await this.statusApi.update(group.id, body, this.projectId as string);
    if (res.done) {
      if (res.body.color_code != null) {
        group.color_code = res.body.color_code + ALPHA_CHANNEL;
      }
    }
  }


}
