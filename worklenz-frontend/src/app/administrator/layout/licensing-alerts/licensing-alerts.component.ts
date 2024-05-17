import {Component, Input} from '@angular/core';
import moment from "moment";

@Component({
  selector: 'worklenz-licensing-alerts',
  templateUrl: './licensing-alerts.component.html',
  styleUrls: ['./licensing-alerts.component.scss']
})
export class LicensingAlertsComponent {
  @Input() profile: any;

  readonly licensingClose = "worklenz.licensing_close";

  string1 = '';
  string2 = '';

  getVisible(): boolean {
    const date = this.getLicensingLastClose();
    if (date) {
      if ((moment(date).isSame(moment(), 'day'))) return false;
    }

    const validTillDate = moment(this.profile.valid_till_date);
    if (validTillDate.isAfter(moment(), 'days')) validTillDate.add(1, 'day');

    // Calculate the difference in days between the two dates
    const daysDifference = validTillDate.diff(moment(), 'days');
    if (!this.profile.valid_till_date || daysDifference >= 7) return false;

    this.string2 = ` ${Math.abs(daysDifference)} day${Math.abs(daysDifference) === 1 ? "" : 's'}`;

    if (this.profile.subscription_status === 'trialing') {
      if (daysDifference < 0) {
        this.string1 = `Your Worklenz trial expired`;
        this.string2 = this.string2 + ' ago';
      } else if (daysDifference !== 0 && daysDifference < 7) {
        this.string1 = `Your Worklenz trial expires in`;
      } else if (daysDifference === 0 && daysDifference < 7) {
        this.string1 = `Your Worklenz trial expires `;
        this.string2 = 'today';
      }
      return true;
    }

    if (this.profile.subscription_status === 'active') {
      if (daysDifference < 0) {
        this.string1 = `Your Worklenz subscription expired`;
        this.string2 = this.string2 + ' ago';
      } else if (daysDifference !== 0 && daysDifference < 7) {
        this.string1 = `Your Worklenz subscription expires in`;
      } else if (daysDifference === 0 && daysDifference < 7) {
        this.string1 = `Your Worklenz subscription expires `;
        this.string2 = 'today';
      }
      return true;
    }

    return false
  }

  setLicensingLastClose() {
    localStorage.setItem(this.licensingClose, moment().format('YYYY-MM-DD'));
  }

  getLicensingLastClose() {
    return localStorage.getItem(this.licensingClose);
  }
}
