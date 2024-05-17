import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";
import {log_error} from "@shared/utils";
import {ProjectTemplateApiService} from "@api/project-template-api.service";
import {ICustomTemplate} from "@interfaces/api-models/project-template";

@Component({
  selector: 'worklenz-project-templates',
  templateUrl: './project-templates.component.html',
  styleUrls: ['./project-templates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectTemplatesComponent implements OnInit{
  loading = false;

  projectTemplates: ICustomTemplate[] = []

  constructor(
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly api: ProjectTemplateApiService
  ) {
  }

  ngOnInit() {
    void this.get();
  }

  async get() {
    try {
      this.loading = true;
      const res = await this.api.getWorklenzCustomTemplates();
      if (res.done) {
        this.projectTemplates = res.body;
        this.loading = false;
        this.cdr.markForCheck();
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      log_error(e)
      this.cdr.markForCheck();
    }
  }

  editTemplate(id: string | undefined, name: string | undefined) {
    if (!id || !name) return;
    this.router.navigate([`/worklenz/settings/project-templates/edit/${id}/${name}`]);
  }

  async deleteTemplate(id: string | undefined) {
    if (!id) return;
    try {
      const res = await this.api.delete(id);
      if (res.done) {
        void this.get();
      }
    } catch (e) {
      log_error(e);
    }
  }

}
