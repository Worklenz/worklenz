import {Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ProfileSettingsApiService} from "@api/profile-settings-api.service";
import {AppService} from "@services/app.service";
import {MenuService} from "@services/menu.service";
import {log_error} from "@shared/utils";
import {TaskTemplatesService} from "@api/task-templates.service";
import {ITaskTemplatesGetResponse} from "@interfaces/api-models/task-templates-get-response";

@Component({
  selector: 'worklenz-task-templates',
  templateUrl: './task-templates.component.html',
  styleUrls: ['./task-templates.component.scss']
})
export class TaskTemplatesComponent {
  form!: FormGroup;
  taskTemplates: ITaskTemplatesGetResponse[] = [];

  loading = false;
  updating = false;
  drawerVisible = false;

  private editingTeamId: string | null = null;
  selectedTemplateId: string = '';

  constructor(
    private api: TaskTemplatesService,
    private settingsApi: ProfileSettingsApiService,
    private fb: FormBuilder,
    private app: AppService,
    public menu: MenuService
  ) {
    this.app.setTitle("Task Templates");
    this.form = this.fb.group({
      name: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.getTaskTemplates().then(r => r);
  }

  async getTaskTemplates() {
    try {
      this.loading = true;
      const res = await this.api.get();
      if (res.done) {
        this.taskTemplates = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
      log_error(e);
    }
  }

  closeModal() {
    this.drawerVisible = false;
  }

  editTemplate(id: string | undefined) {
    if (!id) return;
    this.selectedTemplateId = id;
    this.drawerVisible = true;
  }

  taskTemplateCancel(visible: boolean) {
    this.drawerVisible = visible;
    this.selectedTemplateId = '';
  }

  onCreateOrUpdate() {
    this.getTaskTemplates().then(r => r);
  }

  async deleteTemplate(id: string = '') {
    try {
      const res = await this.api.delete(id);
      if (res.done) {
        void this.getTaskTemplates();
      }
    } catch (e) {

    }
  }
}
