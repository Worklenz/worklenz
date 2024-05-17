import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {IServerResponse} from '@interfaces/api-models/server-response';
import {toQueryString} from '@shared/utils';
import {APIServiceBase} from './api-service-base';
import {IMyTask} from "@interfaces/my-tasks";
import {IHomeTasksConfig, IHomeTasksModel, IPersonalTask} from "../../administrator/my-dashboard/intefaces";
import {IProject} from "@interfaces/project";
import {IProjectViewModel} from "@interfaces/api-models/project-view-model";

@Injectable({
  providedIn: 'root'
})
export class HomePageApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/home`;

  constructor(private http: HttpClient) {
    super();
  }

  createPersonalTask(body: IPersonalTask): Promise<IServerResponse<IMyTask>> {
    return this._post(this.http, `${this.root}/personal-task`, body);
  }

  getMyTasks(config: IHomeTasksConfig): Promise<IServerResponse<IHomeTasksModel>> {
    const group_by = config.tasks_group_by;
    const current_tab = config.current_tab;
    const is_calendar_view = config.is_calendar_view;
    const selected_date = config.selected_date?.toISOString().split('T')[0];
    const time_zone = config.time_zone;

    const url = `${this.root}/tasks${toQueryString({group_by, current_tab, is_calendar_view, selected_date, time_zone})}`;
    return this._get(this.http, url);
  }

  getPersonalTasks(): Promise<IServerResponse<IMyTask[]>> {
    const url = `${this.root}/personal-tasks`;
    return this._get(this.http, url);
  }

  getProjects(view: number): Promise<IServerResponse<IProjectViewModel[]>> {
    const url = `${this.root}/projects${toQueryString({view})}`;
    return this._get(this.http, url);
  }

  getProjectsByTeam(): Promise<IServerResponse<IProject[]>> {
    const url = `${this.root}/team-projects`;
    return this._get(this.http, url);
  }

  taskMarkAsDone(id: string): Promise<IServerResponse<any>> {
    return this._put(this.http, `${this.root}/update-personal-task`, {id});
  }

}
