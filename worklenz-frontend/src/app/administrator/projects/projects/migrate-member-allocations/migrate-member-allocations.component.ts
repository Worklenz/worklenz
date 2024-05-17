import {Component, OnInit} from '@angular/core';
import {ScheduleApiService} from "@api/schedule-api.service";

@Component({
  selector: 'worklenz-migrate-member-allocations',
  templateUrl: './migrate-member-allocations.component.html',
  styleUrls: ['./migrate-member-allocations.component.scss']
})
export class MigrateMemberAllocationsComponent implements OnInit{
  constructor(
    private readonly api: ScheduleApiService
  ) {}

  async ngOnInit() {
    const res = await this.api.migrateAllocations();
    if(res.done) {
      alert("Drop migrate_member_allocations postgres function.")
    }
  }

}
