import {Params} from "@angular/router";

export interface IWorklenzNotification {
  id: string;
  team: string;
  team_id: string;
  message: string;
  project?: string;
  color?: string;
  url?: string;
  task_id?: string;
  params?: Params;
  created_at?: string;
}
