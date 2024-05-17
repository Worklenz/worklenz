import {ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {TasksApiService} from "@api/tasks-api.service";
import {ITaskStatus} from "@interfaces/task-status";
import {AuthService} from "@services/auth.service";
import {NzSelectComponent} from "ng-zorro-antd/select";
import {merge, Subject, takeUntil} from "rxjs";
import {TaskListHashMapService} from "../../task-list-hash-map.service";
import {TaskListV2Service} from "../../task-list-v2.service";
import {log_error} from "@shared/utils";
import {ITaskPriority} from "@interfaces/task-priority";
import {ITaskPhase} from "@interfaces/api-models/task-phase";

@Component({
  selector: 'worklenz-task-list-bulk-actions',
  templateUrl: './task-list-bulk-actions.component.html',
  styleUrls: ['./task-list-bulk-actions.component.scss']
})
export class TaskListBulkActionsComponent implements OnDestroy {
  newLabelForm!: FormGroup;

  @ViewChild("labelsSelect", {static: false}) labelsSelect!: NzSelectComponent;

  statuses: ITaskStatus[] = [];
  priorities: ITaskPriority[] = [];
  phases: ITaskPhase[] = [];
  @Input() selectedStatus: string | null = null;
  @Input() filteredAsArchived = false;

  @Output() bulkUpdateSuccess: EventEmitter<any> = new EventEmitter();
  @Output() labelsUpdate: EventEmitter<any> = new EventEmitter();
  @Output() taskTemplateClicked: EventEmitter<any> = new EventEmitter();

  changingStatus = false
  changingPriority = false
  changingPhase = false;
  changingLabels = false;
  deletingTasks = false;
  archivingTasks = false;
  assigningTasks = false;
  assigningLabel = false;
  assigningMembers = false;
  labelsDropdownVisible = false;
  groupChangeVisible = false;
  membersDropdownVisible = false;

  projectId: string | null = null;

  selectedCount = 0;

  get deleteConfirmationMessage() {
    return 'All ' + this.selectedCount + ' tasks will be deleted and cannot be undone.';
  }

  get newLabel() {
    return this.newLabelForm.valid;
  }

  get label() {
    const w = this.selectedCount < 2
      ? 'task'
      : 'tasks';
    return `${this.selectedCount} ${w} selected`;
  }

  protected isOpen = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly api: TasksApiService,
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly map: TaskListHashMapService,
    public readonly service: TaskListV2Service
  ) {
    this.projectId = this.service.getProjectId();

    this.newLabelForm = this.fb.group({
      label: [null, Validators.required]
    });

    this.service.onStatusesChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // this.statuses = this.service.statuses;
      });

    merge(this.map.onSelect$, this.map.onDeselect$, this.map.onDeselectAll$)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (value) => {
        await this.getGroups();
        const count = this.map.getSelectedCount();
        this.isOpen = count > 0;
        this.selectedCount = count;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async getGroups() {
    this.statuses = this.service.statuses;
    this.priorities = this.service.priorities;
    this.phases = this.service.phases;
  }

  async changeStatus(selectedStatus: string | undefined) {
    if(!selectedStatus) return;
    try {
      this.changingStatus = true;
      const res = await this.api.bulkChangeStatus({
        tasks: this.map.getSelectedTaskIds(),
        status_id: selectedStatus as string
      }, this.projectId as string);
      if (res.done) {
        this.bulkUpdateSuccess.emit();
      }
      this.changingStatus = false;
    } catch (e) {
      this.changingStatus = false;
    }
  }

  async changePriority(selectedPriority: string | undefined) {
    if(!selectedPriority) return;
    try {
      this.changingPriority = true;
      const res = await this.api.bulkChangePriority({
        tasks: this.map.getSelectedTaskIds(),
        priority_id: selectedPriority as string
      }, this.projectId as string);
      if (res.done) {
        this.bulkUpdateSuccess.emit();
      }
      this.changingPriority = false;
    } catch (e) {
      this.changingPriority = false;
    }
  }
  async changePhase(selectedPhase: string | undefined) {
    if(!selectedPhase) return;
    try {
      this.changingPriority = true;
      const res = await this.api.bulkChangePhase({
        tasks: this.map.getSelectedTaskIds(),
        phase_id: selectedPhase as string
      }, this.projectId as string);
      if (res.done) {
        this.bulkUpdateSuccess.emit();
      }
      this.changingPriority = false;
    } catch (e) {
      this.changingPriority = false;
    }
  }

  async bulkDelete() {
    try {
      this.deletingTasks = true;
      const res = await this.api.bulkDelete({tasks: this.map.getSelectedTaskIds()}, this.projectId as string);
      if (res.done) {
        this.bulkUpdateSuccess.emit();
      }
      this.deletingTasks = false;
    } catch (e) {
      this.deletingTasks = false;
    }
  }

  async bulkArchive() {
    try {
      if (this.isSelectionHasSubTasks()) return;
      this.archivingTasks = true;
      const res = await this.api.bulkArchive({
        tasks: this.map.getSelectedTaskIds(), project_id: this.projectId as string
      }, this.filteredAsArchived);
      if (res.done) {
        this.bulkUpdateSuccess.emit();
      }
      this.archivingTasks = false;
    } catch (e) {
      this.archivingTasks = false;
    }
  }

  async bulkAssignMe() {
    if (!this.projectId) return;
    try {
      this.assigningTasks = true;
      const res = await this.api.bulkAssignMe({
        tasks: this.map.getSelectedTaskIds(),
        project_id: this.projectId
      });
      if (res.done) {
        this.bulkUpdateSuccess.emit();
      }
      this.assigningTasks = false;
    } catch (e) {
      this.assigningTasks = false;
    }
  }

  async bulkAssignLabel() {
    try {
      this.assigningLabel = true;
      const res = await this.api.bulkAssignLabel({
        tasks: this.map.getSelectedTaskIds(),
        text: this.newLabelForm.value.label || null,
        labels: this.service.labels.filter(l => l.selected)
      }, this.projectId as string);
      if (res.done) {
        this.bulkUpdateSuccess?.emit();
        this.labelsUpdate?.emit();
        this.resetLabels();
      }
      this.assigningLabel = false;
    } catch (e) {
      this.assigningLabel = false;
    }
  }

  async bulkAssignMembers() {
    try {
      this.assigningMembers = true;
      const res = await this.api.bulkAssignMembers({
        tasks: this.map.getSelectedTaskIds(),
        project_id: this.projectId as string,
        members: this.service.members.filter(m => m.selected)
      });
      if (res.done) {
        this.bulkUpdateSuccess?.emit();
        // this.labelsUpdate?.emit();
        this.resetMembers();
      }
      this.assigningMembers = false;
    } catch (e) {
      this.assigningMembers = false;
      log_error(e)
    }
  }

  isSelectionHasSubTasks() {
    // return this.map.isSelectionHasSubTasks();
    // TODO
    return 0;
  }

  close() {
    this.map.deselectAll();
  }

  private deselectAll() {
    this.labelsDropdownVisible = false;
    this.service.labels.forEach(l => l.selected = false);
  }

  private deselectAllMembers() {
    this.membersDropdownVisible = false;
    this.service.members.forEach(l => l.selected = false);
  }

  private resetLabels() {
    this.deselectAll();
    this.newLabelForm.controls["label"].setValue(null);
  }

  private resetMembers() {
    this.deselectAllMembers();
  }

  handleLabelsDropdown(visible: boolean) {
    if (!visible) {
      this.resetLabels();
    }
  }

  handleMembersDropdown(visible: boolean) {
    if (!visible) {
      this.resetMembers();
    }
  }

  createLabel() {
    if (this.newLabelForm.valid)
      this.bulkAssignLabel();
  }

  isOwnerOrAdmin() {
    return this.auth.getCurrentSession()?.owner || this.auth.getCurrentSession()?.is_admin;
  }
}
