import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {WorklenzAlert} from "@interfaces/api-models/local-session";

@Component({
  selector: 'worklenz-alerts',
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlertsComponent {
  @Input() updateAvailable = false;
  @Input() alerts: WorklenzAlert[] = [];

  reload() {
    window.location.reload();
  }

  trackByIndex(index: number, item: any) {
    return item.id;
  }
}
