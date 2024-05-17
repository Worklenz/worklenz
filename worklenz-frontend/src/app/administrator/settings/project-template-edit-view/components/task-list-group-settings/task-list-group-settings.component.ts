import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  Output
} from '@angular/core';
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {AuthService} from "@services/auth.service";
import {ALPHA_CHANNEL, UNMAPPED} from "@shared/constants";
import {calculateTaskCompleteRatio, log_error} from "@shared/utils";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {IPTTaskListGroup} from "../../interfaces";
import {PtTaskListService} from "../../services/pt-task-list.service";
import {PtStatusesApiService} from "@api/pt-statuses-api.service";
import {PtTaskPhasesApiService} from "@api/pt-task-phases-api.service";
import {merge} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'worklenz-task-list-group-settings',
  templateUrl: './task-list-group-settings.component.html',
  styleUrls: ['./task-list-group-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListGroupSettingsComponent {
  @Input() group!: IPTTaskListGroup;
  @Input() templateId: string | null = null;
  @Input() categories: ITaskStatusCategory[] = [];
  @Output() toggle = new EventEmitter<MouseEvent>();
  @Output() onCreateOrUpdate = new EventEmitter();


  protected edit = false;
  protected isEditColProgress = false;
  protected showMenu = false;
  protected isGroupByStatus = false;
  protected isGroupByPhases = false;
  protected isAdmin = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly statusApi: PtStatusesApiService,
    private readonly list: PtTaskListService,
    private readonly ngZone: NgZone,
    private readonly phaseApi: PtTaskPhasesApiService,
  ) {
    merge(
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

  protected async changeStatusCategory(group: IPTTaskListGroup, categoryId?: string) {
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

  private handleGroupProgressChange = () => {
    const group = this.group;
    if (!group) return;

    this.cdr.markForCheck();
  }

  protected async onBlurEditColumn(group: IPTTaskListGroup) {
    if (!this.templateId || this.isEditColProgress) return;

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

  protected async updateName(group: IPTTaskListGroup) {
    if (!this.templateId || this.isEditColProgress) return;

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

  private async updateGroupName(group: IPTTaskListGroup) {
    if (!group?.id || !this.templateId) return;
    try {
      const body = {
        name: group.name,
        template_id: this.templateId,
        category_id: group.category_id
      };
      const res = await this.statusApi.updateName(group.id, body);
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

  private async updatePhase(group: IPTTaskListGroup) {
    if (!group?.id || !this.templateId) return;
    try {
      const body = {
        id: group.id,
        name: group.name
      };
      const res = await this.phaseApi.update(this.templateId, body as ITaskPhase);
      if (res.done) {
        const phases = this.list.phases;
        const phase = phases.find(p => p.id === res.body.id);
        if (phase) {
          this.group.name = phase.name = res.body.name;
          this.group.color_code = phase.color_code = res.body.color_code;
        }
        this.list.phases = phases;
      }
    } catch (e) {
      // ignored
    }

    this.cdr.markForCheck();
  }

  private async update(group: IPTTaskListGroup) {
    if (!this.isAdmin) return;
    const body = {
      name: group.name,
      template_id: this.templateId as string,
      category_id: group.category_id
    };
    const res = await this.statusApi.update(group.id, body);
    if (res.done) {
      if (res.body.color_code != null) {
        group.color_code = res.body.color_code + ALPHA_CHANNEL;
        this.onCreateOrUpdate.emit();
      }
    }
    this.cdr.markForCheck();
  }
}
