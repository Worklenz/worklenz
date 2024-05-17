import {Component} from '@angular/core';
import {ProjectTemplateApiService} from "@api/project-template-api.service";

@Component({
  selector: 'worklenz-migrate-templates',
  templateUrl: './migrate-templates.component.html',
  styleUrls: ['./migrate-templates.component.scss']
})
export class MigrateTemplatesComponent {
  constructor(
    private readonly api: ProjectTemplateApiService
  ) {
    this.import();
  }

  async import() {
    await this.api.createTemplates();
  }
}
