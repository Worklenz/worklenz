import {Injectable} from '@angular/core';
import {dispatchMenuChange} from "@shared/events";

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  public readonly CLIENTS_MENU = "clients";
  public readonly JOB_TITLES_MENU = "job-titles";
  public readonly TEAMS_MENU = "teams";
  public readonly LABELS_MENU = "labels";
  public readonly TASK_STATUSES_MENU = "task-statuses";
  private readonly prefix = "worklenz.pinned-tab";
  public readonly TASK_TEMPLATES_MENU = "task-templates";

  isPinned(key: string) {
    return !!localStorage.getItem(`${this.prefix}.${key}`);
  }

  public toggle(key: string) {
    if (this.isPinned(key)) {
      this.unpin(key);
    } else {
      this.pin(key);
    }
    dispatchMenuChange();
  }

  private pin(key: string) {
    localStorage.setItem(`${this.prefix}.${key}`, "1");
  }

  private unpin(key: string) {
    localStorage.removeItem(`${this.prefix}.${key}`);
  }
}
