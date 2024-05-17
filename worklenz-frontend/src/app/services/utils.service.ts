import {Injectable} from '@angular/core';
import {AvatarNamesMap} from "@shared/constants";
import moment from "moment/moment";

@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  getColor(name?: string) {
    return AvatarNamesMap[name?.charAt(0).toUpperCase() || 'A'];
  }

  checkForMinDate(start?: any) {
    return (end: Date) => {
      if (!start) return false;
      return !moment(start).isSame(end, 'day') && moment(start).isAfter(end);
    };
  }

  checkForMaxDate(end?: any) {
    return (start: Date) => {
      if (!end) return false;
      return !moment(end).isSame(start, 'day') && moment(start).isAfter(end);
    };
  }

  isTestServer() {
    const testServers = ["localhost", "uat.worklenz.com", "dev.worklenz.com"];
    const host = window.location.hostname;
    return testServers.includes(host);
  }

  toRound(value: string | number) {
    return /\d+/.test(value as string) ? Math.ceil(+value) : 0;
  }

  buildTimeString(hours: number, minutes: number, seconds: number) {
    const h = hours > 0 ? `${hours}h` : '';
    const m = `${minutes}m`;
    const s = `${seconds}s`;
    return `${h} ${m} ${s}`.trim();
  }

  handleLastIndex(total: number, length: number, index: number, callback: (index: number) => void) {
    if (total > 0 && length === 0) {
      const i = index - 1;
      index = i < 0 ? 0 : i;
      if (index > 0)
        callback(index);
    }
  }

  sortBySelection(data: Array<{ selected?: boolean; }>) {
    data.sort((a, b) => {
      if (a.selected && b.selected) return 0;
      if (a.selected) return -1;
      return 1;
    });
  };

  sortByPending(data: Array<{ is_pending?: boolean; }>) {
    data.sort((a, b) => {
      if (!a.is_pending && !b.is_pending) return 0;
      if (!a.is_pending) return -1;
      return 1;
    });
  };

  sanitizeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
