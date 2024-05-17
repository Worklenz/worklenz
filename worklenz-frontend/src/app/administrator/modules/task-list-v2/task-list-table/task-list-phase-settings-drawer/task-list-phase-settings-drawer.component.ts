import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component, ElementRef,
  EventEmitter,
  Input,
  Output, QueryList,
  ViewChildren
} from '@angular/core';
import {TaskPhasesApiService} from "@api/task-phases-api.service";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {TaskListV2Service} from "../../task-list-v2.service";
import {ProjectPhasesService} from "@services/project-phases.service";
import {ProjectsService} from "../../../../projects/projects.service";
import {AuthService} from "@services/auth.service";
import {PhaseColorCodes} from "@shared/constants";
import {CdkDragDrop, moveItemInArray} from '@angular/cdk/drag-drop';
import {deepClone, log_error} from "@shared/utils";

@Component({
  selector: 'worklenz-task-list-phase-settings-drawer',
  templateUrl: './task-list-phase-settings-drawer.component.html',
  styleUrls: ['./task-list-phase-settings-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListPhaseSettingsDrawerComponent {
  @ViewChildren('input') inputs: QueryList<ElementRef> | undefined;

  @Input() projectId: string | null = null;

  @Input() show = false;
  @Output() showChange = new EventEmitter<boolean>();
  @Output() getGroups = new EventEmitter<void>();

  loading = false;
  creating = false;
  updatingLabel = false;
  sorting = false;

  updating: { [x: string]: boolean } = {};
  deleting: { [x: string]: boolean } = {};
  updateCache: { [x: string]: string } = {};

  readonly COLOR_CODES = PhaseColorCodes;

  oldLabel: string | null = null;
  phaseLabel: string | null = null;
  phasesList:ITaskPhase[] = []

  get options() {
    return this.list.phases;
  }

  constructor(
    private readonly api: TaskPhasesApiService,
    private readonly cdr: ChangeDetectorRef,
    public readonly list: TaskListV2Service,
    private readonly service: ProjectPhasesService,
    private readonly projectsService: ProjectsService,
    public readonly auth: AuthService
  ) {
  }

  close() {
    this.show = false;
    this.showChange.emit(false);
  }

  addNewOption() {
    void this.create();
  }

  onVisibleChange(visible: boolean) {
    if (visible) {
      void this.get(true);
      this.phaseLabel = this.service.label;
    }
  }

  removeOption(id: string) {
    if (!id) return;
    void this.delete(id);
  }

  async updateOption(phase: ITaskPhase) {
    await this.update(phase);
    delete this.updateCache[phase.id];
  }

  setNameCache(id: string, name: string) {
    this.updateCache[id] = name;
  }

  isProjectManager() {
    if (this.projectsService.projectOwnerTeamMemberId) return this.auth.getCurrentSession()?.team_member_id === this.projectsService.projectOwnerTeamMemberId;
    return false;
  }

  private async create() {
    if (!this.projectId || this.creating) return;
    try {
      this.creating = true;

      const res = await this.api.create(this.projectId, this.isProjectManager());
      if (res.done) {
        await this.get(false);
        this.service.emitOptionsChange();
        this.focusNewElement();
      }
      this.creating = false;
    } catch (e) {
      this.creating = false;
    }

    this.cdr.markForCheck();
  }

  focusNewElement() {
    setTimeout(() => {
      this.inputs?.first.nativeElement.focus()
    }, 150)
  }

  private async get(loading: boolean) {
    if (!this.projectId) return;
    try {
      this.loading = loading;
      const res = await this.api.get(this.projectId);
      if (res.done) {
        this.list.phases = res.body;
        this.phasesList = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  public async updateLabel(label: string | null) {
    if (!this.projectId) return;

    if (!label?.trim()) {
      this.phaseLabel = this.oldLabel;
      return;
    }

    try {
      this.updatingLabel = true;
      const res = await this.api.updateLabel(this.projectId, label?.trim(), this.isProjectManager());
      if (res.done) {
        this.service.updateLabel(label?.trim());
      }
      this.updatingLabel = false;
    } catch (e) {
      this.updatingLabel = false;
    }

    this.cdr.markForCheck();
  }

  private async updateColor(phase: ITaskPhase) {
    if (!phase?.id || !this.projectId) return;
    try {
        this.updating[phase.id] = true;
        const res = await this.api.updateColor(this.projectId, phase);
        if (res.done) {
          this.service.emitOptionsChange();
        }
        this.updating[phase.id] = false;
      } catch (e) {
        phase.name = this.updateCache[phase.id];
        this.updating[phase.id] = false;
      }
      this.cdr.markForCheck();
  }

  private async update(phase: ITaskPhase) {
    if (!phase?.id || !this.projectId || this.updating[phase.id]) return;
    if (this.updateCache[phase.id] === phase.name) return;

    try {
      this.updating[phase.id] = true;
      const res = await this.api.update(this.projectId, phase, this.isProjectManager());
      if (res.done) {
        await this.get(false);
        this.service.emitOptionsChange();
      }
      this.updating[phase.id] = false;
    } catch (e) {
      phase.name = this.updateCache[phase.id];
      this.updating[phase.id] = false;
    }
    this.cdr.markForCheck();
  }

  private async delete(id: string) {
    if (!id || !this.projectId || this.deleting[id]) return;
    try {
      this.deleting[id] = true;
      const res = await this.api.delete(id, this.projectId, this.isProjectManager());
      if (res.done) {
        const index = this.list.phases.findIndex(o => o.id === id);
        if (index > -1) {
          this.list.phases.splice(index, 1);
          this.service.emitOptionsChange();
        }
      }
      this.deleting[id] = false;
    } catch (e) {
      this.deleting[id] = false;
    }

    this.cdr.markForCheck();
  }

  async setColorCode(option: ITaskPhase, color: string) {
    option.color_code = color+'69';
    await this.updateColor(option);
  }


async drop(event: CdkDragDrop<ITaskPhase[]>) {
  if (event.previousIndex === event.currentIndex) return;
  moveItemInArray(this.list.phases, event.previousIndex, event.currentIndex);
  this.list.phases = deepClone(this.list.phases);
  this.cdr.markForCheck();
  await this.updateSortOrder(event.previousIndex, event.currentIndex, this.list.phases)
}

  async updateSortOrder(fromIndex: number, toIndex: number, phases: ITaskPhase[]) {
    if(!this.projectId || !phases.length || phases.length === 0) return;
    try {
      this.sorting = true;
      const body = {
        from_index: fromIndex,
        to_index: toIndex,
        phases: phases,
        project_id: this.projectId
      }
      const res = await this.api.updateSortOrder(body, this.projectId);
      if(res.done) {
        this.getGroups.emit();
        await this.get(false);
        this.sorting = false;
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e)
      this.sorting = false;
      this.cdr.markForCheck();
    }
  }

}
