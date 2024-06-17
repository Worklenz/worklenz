import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output} from '@angular/core';
import {PtTaskListService} from "../../services/pt-task-list.service";
import {ProjectTemplateService} from "@services/project-template.service";
import {PtTaskPhasesApiService} from "@api/pt-task-phases-api.service";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {PhaseColorCodes} from "@shared/constants";

@Component({
  selector: 'worklenz-phase-settings-drawer',
  templateUrl: './phase-settings-drawer.component.html',
  styleUrls: ['./phase-settings-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PhaseSettingsDrawerComponent {
  @Input() templateId: string | null = null;

  @Input() show = false;
  @Output() showChange = new EventEmitter<boolean>();
  @Output() onCreateOrUpdate = new EventEmitter();
  @Output() refresh = new EventEmitter();

  readonly COLOR_CODES = PhaseColorCodes

  loading = false;
  creating = false;
  updatingLabel = false;

  updating: { [x: string]: boolean } = {};
  deleting: { [x: string]: boolean } = {};
  updateCache: { [x: string]: string } = {};

  oldLabel: string | null = null;
  phaseLabel: string | null = null;

  get options() {
    return this.list.phases;
  }

  constructor(
    private readonly api: PtTaskPhasesApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly list: PtTaskListService,
    private readonly service: ProjectTemplateService
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

  private async create() {
    if (!this.templateId || this.creating) return;
    try {
      this.creating = true;
      const res = await this.api.create(this.templateId);
      if (res.done) {
        // this.list.phases.unshift(res.body);
        await this.get(false);
        this.service.emitOptionsChange();
        this.onCreateOrUpdate.emit();
      }
      this.creating = false;
    } catch (e) {
      this.creating = false;
    }

    this.cdr.markForCheck();
  }

  private async get(loading: boolean) {
    if (!this.templateId) return;
    try {
      this.loading = loading;
      const res = await this.api.get(this.templateId);
      if (res.done) {
        this.list.phases = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  public async updateLabel(label: string | null) {
    if (!this.templateId) return;

    if (!label?.trim()) {
      this.phaseLabel = this.oldLabel;
      return;
    }

    try {
      this.updatingLabel = true;
      const res = await this.api.updateLabel(this.templateId, label?.trim());
      if (res.done) {
        this.service.updateLabel(label?.trim());
      }
      this.updatingLabel = false;
    } catch (e) {
      this.updatingLabel = false;
    }

    this.cdr.markForCheck();
  }

  private async update(phase: ITaskPhase) {
    if (!phase?.id || !this.templateId || this.updating[phase.id]) return;
    if (this.updateCache[phase.id] === phase.name) return;

    try {
      this.updating[phase.id] = true;
      const res = await this.api.update(this.templateId, phase);
      if (res.done) {
        await this.get(false);
        this.service.emitOptionsChange();
        this.onCreateOrUpdate.emit();
      }
      this.updating[phase.id] = false;
    } catch (e) {
      phase.name = this.updateCache[phase.id];
      this.updating[phase.id] = false;
    }

    this.cdr.markForCheck();
  }

  private async delete(id: string) {
    if (!id || !this.templateId || this.deleting[id]) return;
    try {
      this.deleting[id] = true;
      const res = await this.api.delete(id, this.templateId);
      if (res.done) {
        const index = this.list.phases.findIndex(o => o.id === id);
        if (index > -1) {
          this.list.phases.splice(index, 1);
          this.service.emitOptionsChange();
          this.onCreateOrUpdate.emit();
        }
      }
      this.deleting[id] = false;
    } catch (e) {
      this.deleting[id] = false;
    }

    this.cdr.markForCheck();
  }

  async setColorCode(phase: ITaskPhase, color_code: string){
    phase.color_code = color_code+'69';
    await this.updateColor(phase);
  }

  private async updateColor(phase: ITaskPhase) {
    if (!phase?.id || !this.templateId) return;
    try {
        this.updating[phase.id] = true;
        const res = await this.api.updateColor(this.templateId, phase);
        if (res.done) {
          this.refresh.emit();
        }
        this.updating[phase.id] = false;
      } catch (e) {
        phase.name = this.updateCache[phase.id];
        this.updating[phase.id] = false;
      }
      this.cdr.markForCheck();
  }

}
