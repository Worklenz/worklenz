import {Component, OnInit} from '@angular/core';
import {PersonalOverviewService} from '@api/personal-overview.service';
import moment from 'moment';
import {NzListModule} from "ng-zorro-antd/list";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NgForOf, NgIf} from "@angular/common";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzIconModule} from "ng-zorro-antd/icon";

@Component({
  selector: 'worklenz-personal-project-insights-member-overview',
  templateUrl: './personal-overview.component.html',
  styleUrls: ['./personal-overview.component.scss'],
  imports: [
    NzListModule,
    NzCardModule,
    NzSpaceModule,
    NgForOf,
    NgIf,
    NzToolTipModule,
    NzIconModule
  ],
  standalone: true
})
export class PersonalOverviewComponent implements OnInit {
  loading = false;
  activity_log_loading = false;
  tasks_due_today_loading = false;
  tasks_due_loading = false;

  activityLog: any = [];
  tasksDueToday: any = [];
  tasksRemaining: any = [];

  constructor(
    private personalOverviewService: PersonalOverviewService
  ) {
  }

  ngOnInit(): void {
    this.getActivityLog().then(r => r);
    this.getTasksDueToday().then(r => r);
    this.getTasksRemaining().then(r => r);
  }

  async getActivityLog() {
    try {
      this.activity_log_loading = true;
      const res = await this.personalOverviewService.getActivityLog();
      if (res.done) {
        this.activityLog = res.body;
      }
      this.activity_log_loading = false;
    } catch (e) {
      this.activity_log_loading = false;
    }
  }

  async getTasksDueToday() {
    try {
      this.tasks_due_today_loading = true;
      const res = await this.personalOverviewService.getTasksDueToday();
      if (res.done) {
        this.tasksDueToday = res.body;
      }
      this.tasks_due_today_loading = false;
    } catch (e) {
      this.tasks_due_today_loading = false;
    }
  }

  async getTasksRemaining() {
    try {
      this.tasks_due_loading = true;
      const res = await this.personalOverviewService.getRemainingTasks();
      if (res.done) {
        this.tasksRemaining = res.body;
      }
      this.tasks_due_loading = false;
    } catch (e) {
      this.tasks_due_loading = false;
    }
  }

  getTimestamp(created_at: string) {
    return moment(created_at).fromNow();
  }

  getSpecificTime(created_at: string) {
    return moment(created_at).format('YYYY-MM-DD hh:mm:ss A');
  }
}
