import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TaskStatusesApiService} from '@api/task-statuses-api.service';
import {AppService} from '@services/app.service';
import {ProjectsDefaultColorCodes} from '@shared/constants';
import {dispatchStatusChange} from '@shared/events';
import {ITaskStatus} from '@interfaces/task-status';
import {log_error} from "@shared/utils";
import {ITaskStatusCategory} from "@interfaces/task-status-category";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzBadgeModule} from "ng-zorro-antd/badge";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzInputModule} from "ng-zorro-antd/input";
import {NgForOf, NgIf} from "@angular/common";
import {KanbanV2Service} from 'app/administrator/modules/kanban-view-v2/kanban-view-v2.service';
import {AuthService} from "@services/auth.service";
import {ProjectsService} from "../../projects/projects.service";
import {TaskListV2Service} from "../../modules/task-list-v2/task-list-v2.service";
import {ITaskListGroup} from "../../modules/task-list-v2/interfaces";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {NzDividerModule} from "ng-zorro-antd/divider";

@Component({
  selector: 'worklenz-status-form',
  templateUrl: './status-form.component.html',
  styleUrls: ['./status-form.component.scss'],
  imports: [
    NzSelectModule,
    NzSkeletonModule,
    NzDrawerModule,
    NzBadgeModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzToolTipModule,
    NzButtonModule,
    NgForOf,
    NgIf,
    NzTypographyModule,
    NzDividerModule
  ],
  standalone: true
})
export class StatusFormComponent {
  @Input() action: string = 'Create';
  @Input() show = false;
  @Input() statusId: string | null = null;
  @Input() projectId: string | null = null;
  @Input() showStatusGroups = false;

  @Output() onCreateOrUpdate: EventEmitter<any> = new EventEmitter<any>();
  @Output() onCancel: EventEmitter<any> = new EventEmitter<any>();

  form!: FormGroup;
  loading = true;
  loadingCategories = false;

  categories: ITaskStatusCategory[] = [];
  taskStatus: ITaskStatus = {};
  categorisedStatus: {
    name?: string;
    description?: string;
    statuses: ITaskListGroup[];
    id?: string;
    color_code?: string
  }[] = [];

  constructor(
    private api: TaskStatusesApiService,
    private fb: FormBuilder,
    private app: AppService,
    private readonly kanbanService: KanbanV2Service,
    private readonly auth: AuthService,
    private readonly projectsService: ProjectsService,
    private readonly tasklistService: TaskListV2Service
  ) {
    this.createForm();
  }

  init() {
    this.form.controls["project_id"].setValue(this.projectId);
    void this.getCategories();
    if (this.statusId) {
      void this.getById(this.statusId);
    } else {
      this.loading = false;
    }

  }

  closeModal() {
    this.show = false;
    this.form.reset();
    this.action = 'Create';
    this.createForm();
    this.onCancel.emit();
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
        this.categorisedStatus = this.categories.map(category => {
          return {
            ...category,
            statuses: this.tasklistService.groups.filter(status => status.category_id === category.id)
          }
        });
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
      const res = await this.api.create(this.form.value, this.projectId as string);
      if (res.done) {
        res.body.color_code = res.body.color_code + "69";
        this.kanbanService.emitOnCreateStatus(res.body);
        this.onCreateOrUpdate.emit();
        this.closeModal();
        dispatchStatusChange();
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
      const res = await this.api.update(this.taskStatus.id, this.form.value, this.projectId as string);
      if (res.done) {
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
      project_id: [this.projectId]
    });
  }
}
