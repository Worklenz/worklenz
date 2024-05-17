import { Component } from '@angular/core';
import {ProjectsApiService} from "@api/projects-api.service";

@Component({
  selector: 'worklenz-migrate-phase-sort-order',
  templateUrl: './migrate-phase-sort-order.component.html',
  styleUrls: ['./migrate-phase-sort-order.component.scss']
})
export class MigratePhaseSortOrderComponent {
  constructor(
    private api: ProjectsApiService,
  ) {}

  async ngOnInit() {
    setTimeout(async () => {
      await this.api.updateExistSortOrder();
    },500);
  }
}
