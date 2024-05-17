import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {TaskTemplatesService} from "@api/task-templates.service";
import {log_error} from "@shared/utils";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzListModule} from "ng-zorro-antd/list";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NgForOf, NgIf} from "@angular/common";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {AppService} from "@services/app.service";
import {TaskListHashMapService} from "../../modules/task-list-v2/task-list-hash-map.service";

@Component({
  selector: 'worklenz-task-template-drawer',
  templateUrl: './task-template-drawer.component.html',
  styleUrls: ['./task-template-drawer.component.scss'],
  standalone: true,
  imports: [
    NzDrawerModule,
    NzFormModule,
    NzListModule,
    ReactiveFormsModule,
    NzInputModule,
    NzButtonModule,
    NgIf,
    NgForOf,
    NzSkeletonModule,
    NzSpinModule
  ]
})
export class TaskTemplateDrawerComponent implements OnChanges {
  @Input() drawerVisible = false;
  @Input() selectedTemplateId = '';

  @Output() onCancelClick = new EventEmitter();
  @Output() onTaskRemove = new EventEmitter();
  @Output() onCreateOrUpdate = new EventEmitter();

  form!: FormGroup;
  tasks: IProjectTask[] = [];

  creating = false;
  loading = false;

  get title() {
    if (this.selectedTemplateId) return `Edit Task Template`;
    return `Create Task Template`;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly map: TaskListHashMapService,
    private readonly service: TaskTemplatesService,
    private readonly app: AppService
  ) {
    this.form = this.fb.group({
      name: [null, Validators.required]
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedTemplateId']?.currentValue) {
      void this.getTemplateData();
    }
  }

  closeDrawer(): void {
    this.onCancelClick.emit(false);
  }

  removeTask(index: number) {
    if (this.tasks.length > 1) {
      this.tasks.splice(index, 1);
    } else {
      this.tasks = [];
    }
  }

  submit() {
    if (this.form.valid) {
      if (this.selectedTemplateId) {
        void this.updateTemplate();
      } else {
        void this.saveTemplate();
      }
    } else {
      this.app.displayErrorsOf(this.form);
    }
  }

  private reset() {
    this.form.reset();
    this.map.deselectAll();
    this.closeDrawer();
    this.onCreateOrUpdate.emit();
  }

  async updateTemplate() {
    try {
      this.creating = true;
      const res = await this.service.updateTemplate(this.selectedTemplateId, {
        name: this.form.value.name || '',
        tasks: this.tasks
      });
      if (res.done) {
        this.reset();
      }
    } catch (e) {
      this.creating = false;
    }
  }

  async saveTemplate() {
    try {
      if (this.form.valid) {
        this.creating = true;
        if (this.form.value.name) {
          const res = await this.service.createTemplate({
            name: this.form.value.name || '',
            tasks: this.tasks
          });
          if (res.done) {
            this.reset();
          }
        }
      }
    } catch (e) {
      this.creating = false;
      log_error(e);
    }
  }

  async getTemplateData() {
    try {
      this.loading = true;
      const res = await this.service.getById(this.selectedTemplateId);
      if (res.done) {
        this.form.setValue({name: res.body.name});
        this.tasks = res.body.tasks || [];
        this.loading = false;
      }
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
  }

  onVisibilityChange(visible: boolean) {
    if (visible) {
      this.tasks = this.map.getSelectedTasks();
    }
  }

}
