import {Component, OnInit} from '@angular/core';
import {ReportingApiService} from "../../../reporting/reporting-api.service";
import {ProjectsApiService} from "@api/projects-api.service";

@Component({
  selector: 'worklenz-migrate-project-phases',
  templateUrl: './migrate-project-phases.component.html',
  styleUrls: ['./migrate-project-phases.component.scss']
})
export class MigrateProjectPhasesComponent implements OnInit{
  constructor(
    private api: ProjectsApiService,
  ) {}

  async ngOnInit() {
    setTimeout(async () => {
      await this.api.updateExistPhaseColors();
    },500);
  }

}
