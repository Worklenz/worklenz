import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {LogsApiService} from "@api/logs-api.service";
import {IActivityLog} from "@interfaces/personal-overview";

@Component({
  selector: 'worklenz-activity-log',
  templateUrl: './activity-log.component.html',
  styleUrls: ['./activity-log.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityLogComponent implements OnInit {
  loading = false;
  activityLog: IActivityLog[] = [];
  private readonly key = "my-dashboard-log-active";

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly api: LogsApiService
  ) {
  }

  get active() {
    if (localStorage.getItem(this.key) === null) {
      this.active = true;
      return true;
    }
    return localStorage.getItem(this.key) === "1";
  }

  set active(value: boolean) {
    localStorage.setItem(this.key, value ? "1" : "0");
  }

  ngOnInit(): void {
    void this.getActivityLog();
  }

  async getActivityLog() {
    if (!this.active) return;
    try {
      this.loading = true;
      const res = await this.api.getActivityLog();
      if (res.done) {
        this.activityLog = res.body;
      }
      this.loading = false;
    } catch (e) {
      this.loading = false;
    }

    this.cdr.markForCheck();
  }

  onActiveChange(active: boolean) {
    this.active = active;
    void this.getActivityLog();
  }
}
