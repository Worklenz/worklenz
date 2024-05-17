import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzGridModule} from "ng-zorro-antd/grid";
import {NzSelectComponent, NzSelectModule} from "ng-zorro-antd/select";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzFormModule} from "ng-zorro-antd/form";
import {TaskTemplatesService} from "@api/task-templates.service";
import {ITaskTemplatesGetResponse} from "@interfaces/api-models/task-templates-get-response";
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {NzListModule} from "ng-zorro-antd/list";
import {NzEmptyModule} from "ng-zorro-antd/empty";
import {AppService} from "@services/app.service";
import {NzDividerModule} from "ng-zorro-antd/divider";
import {SafeStringPipe} from "@pipes/safe-string.pipe";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {DRAWER_ANIMATION_INTERVAL} from "@shared/constants";

@Component({
  selector: 'worklenz-import-tasks-template',
  templateUrl: './import-tasks-template.component.html',
  styleUrls: ['./import-tasks-template.component.scss'],
  standalone: true,
  imports: [CommonModule, NzDrawerModule, NzGridModule, NzSelectModule, NzButtonModule, NzFormModule, FormsModule, NzListModule, NzEmptyModule, ReactiveFormsModule, NzDividerModule, SafeStringPipe, NzTypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportTasksTemplateComponent implements OnDestroy {
  @ViewChild("templateSelect", {static: false}) selectTemplate!: NzSelectComponent;

  @Input() drawerVisible = false;
  @Input() projectId: string | null = null;

  @Output() onImportDone = new EventEmitter();
  @Output() onCancel = new EventEmitter();

  form!: FormGroup;

  selectedId: string | null = null;

  loadingTemplates = false;
  loadingData = false;
  importing = false;

  templates: ITaskTemplatesGetResponse[] = [];
  tasks: IProjectTask[] = [];

  constructor(
    private readonly api: TaskTemplatesService,
    private readonly ngZone: NgZone,
    private readonly app: AppService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      template: [null, Validators.required],
    });

    this.form.get('template')?.valueChanges.subscribe(changes => {
      if (changes) {
        this.selectedId = changes;
        this.templateSelected();
      }
    });
  }

  ngOnDestroy() {
    this.reset();
    this.cdr.markForCheck();
  }

  open(): void {
    this.drawerVisible = true;
    this.cdr.markForCheck();
  }

  closeDrawer(): void {
    this.form.reset();
    this.tasks = [];
    this.onCancel.emit();
    this.cdr.markForCheck();
  }

  onVisibleChange(event: boolean) {
    if (event) {
      void this.getTaskTemplate();
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.selectTemplate?.focus();
        }, DRAWER_ANIMATION_INTERVAL)
      });
    }
    this.cdr.markForCheck();
  }

  async getTaskTemplate() {
    try {
      this.loadingTemplates = true;
      const res = await this.api.get();
      if (res.done) {
        this.templates = res.body;
        this.loadingTemplates = false;
      }
    } catch (e) {
      this.loadingTemplates = false;
    }

    this.cdr.markForCheck();
  }

  async getTemplateData() {
    if (!this.selectedId) return;

    try {
      this.loadingData = true;
      const res = await this.api.getById(this.selectedId);
      if (res.done) {
        this.tasks = res.body.tasks || [];
        this.loadingData = false;
      }
    } catch (e) {
      this.loadingData = false;
    }
    this.cdr.markForCheck();
  }

  templateSelected() {
    void this.getTemplateData();
  }

  removeTask(index: number) {
    if (this.tasks.length > 1) {
      this.tasks.splice(index, 1);
    } else {
      this.tasks = [];
    }
  }

  validateForm() {
    for (const controlName in this.form.controls) {
      this.form.controls[controlName].updateValueAndValidity();
    }
    this.cdr.markForCheck();
  }

  async importFromTemplate() {
    if (!this.projectId) return;

    try {
      this.validateForm();
      if (this.form.invalid) {
        this.form.markAsTouched();
        return;
      }
      if (this.tasks.length) {
        this.importing = true;
        const res = await this.api.import(this.projectId, this.tasks);
        if (res.done) {
          this.api.emitOnImport();
          this.onImportDone.emit();
          this.reset();
          this.drawerVisible = false;
        }
        this.importing = false;
      } else {
        this.app.notify("Incomplete request!", "No tasks to import", false);
      }
    } catch (e) {
      this.importing = false;
    }
    this.cdr.markForCheck();
  }

  private reset() {
    this.tasks = [];
    this.selectedId = null;
    this.form.reset();
    this.cdr.markForCheck();
  }
}
