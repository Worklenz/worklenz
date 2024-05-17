import {Component, EventEmitter, Input, Output} from '@angular/core';
import {PtStatusesApiService} from "@api/pt-statuses-api.service";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ProjectsDefaultColorCodes} from "@shared/constants";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {ITaskStatus} from "@interfaces/task-status";
import {AppService} from "@services/app.service";
import {log_error} from "@shared/utils";
import {dispatchStatusChange} from "@shared/events";

@Component({
  selector: 'worklenz-status-settings-drawer',
  templateUrl: './status-settings-drawer.component.html',
  styleUrls: ['./status-settings-drawer.component.scss']
})
export class StatusSettingsDrawerComponent {
  @Input() action: string = 'Create';
  @Input() show = false;
  @Input() statusId: string | null = null;
  @Input() templateId: string | null = null;

  @Output() showChange = new EventEmitter<boolean>();
  @Output() onCreateOrUpdate = new EventEmitter();

  form!: FormGroup;
  loading = true;
  loadingCategories = false;

  colorCodes = ProjectsDefaultColorCodes;
  categories: ITaskStatusCategory[] = [];
  taskStatus: ITaskStatus = {};

  constructor(
    private api: PtStatusesApiService,
    private fb: FormBuilder,
    private app: AppService,
  ) {
    this.createForm();
  }

  init() {
    this.form.controls["template_id"].setValue(this.templateId);
    this.getCategories();
    if (this.statusId) {
      this.getById(this.statusId);
    } else {
      this.loading = false;
    }
  }

  closeModal() {
    this.show = false;
    this.form.reset();
    this.action = 'Create';
    this.createForm();
    this.showChange.emit();
  }

  async submit() {
    if (this.taskStatus && this.taskStatus.id) {
      await this.updateStatus();
    } else {
      await this.addStatus();
    }
  }

  async getById(id: string) {
    try {
      this.loading = true;
      const res = await this.api.getById(id);
      if (res.done) {
        this.taskStatus = res.body;
        this.form.patchValue(this.taskStatus);
      }
      this.loading = false;
    } catch (e) {
      log_error(e);
      this.loading = false;
    }
  }

  async getCategories() {
    try {
      this.loadingCategories = true;
      const res = await this.api.getCategories();
      if (res.done) {
        this.categories = res.body;
        this.form.controls["category_id"].setValue(this.categories[0].id);
      }
      this.loadingCategories = false;
    } catch (e) {
      this.loadingCategories = false;
      log_error(e);
    }
  }

  async addStatus() {
    if (this.form.invalid) {
      this.app.displayErrorsOf(this.form);
      return;
    }

    try {
      const res = await this.api.create(this.form.value);
      if (res.done) {
        res.body.color_code = res.body.color_code + "69";
        this.onCreateOrUpdate.emit();
        this.closeModal();
      }
    } catch (e) {
      log_error(e);
    }
  }

  async updateStatus() {
    if (!this.taskStatus || !this.taskStatus.id) return;
    if (this.form.invalid) {
      this.app.displayErrorsOf(this.form);
      return;
    }

    try {
      const res = await this.api.update(this.taskStatus.id, this.form.value);
      if (res.done) {
        this.onCreateOrUpdate.emit();
        this.closeModal();
        dispatchStatusChange();
      }
    } catch (e) {
      log_error(e);
    }
  }

  onVisibilityChange(visible: boolean) {
    if (visible) {
      // Wait for drawer animation to finish
      setTimeout(() => this.init(), 100);
    }
  }

  private createForm() {
    this.form = this.fb.group({
      name: [null, [Validators.required]],
      category_id: [null, [Validators.required]],
      template_id: [this.templateId]
    });
  }

}
