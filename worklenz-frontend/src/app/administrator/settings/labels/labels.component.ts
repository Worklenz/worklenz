import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {log_error} from "@shared/utils";
import {TaskLabelsApiService} from "@api/task-labels-api.service";
import {ITaskLabel} from "@interfaces/task-label";
import {MenuService} from "@services/menu.service";
import {ALPHA_CHANNEL, ProjectsDefaultColorCodes} from "@shared/constants";
import {SearchByNamePipe} from "@pipes/search-by-name.pipe";
import {AppService} from "@services/app.service";

@Component({
  selector: 'worklenz-labels',
  templateUrl: './labels.component.html',
  styleUrls: ['./labels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelsComponent implements OnInit {
  colorCodes = ProjectsDefaultColorCodes;
  labels: ITaskLabel[] = [];
  filteredLabels: ITaskLabel[] = [];

  loading = false;
  alpha = ALPHA_CHANNEL;
  labelsSearch: string | null = null;

  constructor(
    private readonly app: AppService,
    private readonly api: TaskLabelsApiService,
    private readonly searchPipe: SearchByNamePipe,
    private readonly cdr: ChangeDetectorRef,
    public readonly menu: MenuService
  ) {
    this.app.setTitle("Manage Labels");
  }

  ngOnInit(): void {
    void this.get();
  }

  trackByFn(index: number, label: ITaskLabel) {
    return label.id;
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.get();
      if (res.done) {
        this.labels = res.body;
        this.filteredLabels = this.labels;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.detectChanges();
  }

  async deleteLabel(label: ITaskLabel) {
    if (!label?.id) return;
    try {
      this.loading = true;
      const res = await this.api.deleteById(label.id);
      if (res.done) {
        void this.get();
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }

    this.cdr.detectChanges();
  }

  async updateColorCode(id?: string, color?: string) {
    if (!id || !color) return;
    try {
      const res = await this.api.updateColor(id, color);
      if (res.done) {
        const label = this.labels.find(l => l.id === id);
        if (label)
          label.color_code = color;
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
    }
  }

  searchLabels(val: string) {
    this.filteredLabels = this.searchPipe.transform(this.labels, val || null) as ITaskLabel[];
    this.cdr.markForCheck();
  }
}
