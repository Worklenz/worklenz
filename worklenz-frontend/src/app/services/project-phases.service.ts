import {Injectable} from '@angular/core';
import {TaskListV2Service} from "../administrator/modules/task-list-v2/task-list-v2.service";
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ProjectPhasesService {
  private readonly _labelChangeSbj$ = new Subject<string>();
  private readonly _phaseOptionsChangeSbj$ = new Subject<void>();
  private readonly DEFAULT_LABEL = 'Phase';

  private _label: string | null = null;

  public get label() {
    return this._label || this.DEFAULT_LABEL;
  }

  private set label(value) {
    this._label = value || this.DEFAULT_LABEL;
  }

  public get onLabelChange() {
    return this._labelChangeSbj$.asObservable();
  }

  public get onPhaseOptionsChange() {
    return this._phaseOptionsChangeSbj$.asObservable();
  }

  constructor(
    private readonly list: TaskListV2Service
  ) {
  }

  public updateLabel(label: string) {
    const phase = this.list.GROUP_BY_OPTIONS.find(p => p.value === this.list.GROUP_BY_PHASE_VALUE);
    if (phase) {
      this.label = label;
      phase.label = this.label;
      this._labelChangeSbj$.next(this.label);
    }
  }

  public emitOptionsChange() {
    this._phaseOptionsChangeSbj$.next();
  }
}
