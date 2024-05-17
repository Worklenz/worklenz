import {Injectable} from '@angular/core';
import {APIServiceBase} from './api-service-base';
import {HttpClient} from '@angular/common/http';
import {lastValueFrom} from 'rxjs';

import {IServerResponse} from '@interfaces/api-models/server-response';
import {IProjectCreateRequest} from '@interfaces/api-models/project-create-request';
import {IProject} from '@interfaces/project';
import {ITeamMemberOverviewGetResponse} from '@interfaces/api-models/team-members-get-response';
import {toQueryString} from "@shared/utils";
import {IProjectsViewModel} from "@interfaces/api-models/projects-view-model";
import {IProjectMembersViewModel} from "@interfaces/api-models/project-members-view-model";
import {IMyDashboardAllTasksViewModel} from "@interfaces/api-models/my-dashboard-all-tasks-view-model";
import {NzTableFilterList} from 'ng-zorro-antd/table';
import {IProjectViewModel} from "@interfaces/api-models/project-view-model";
import {IProjectFilterConfig} from "@interfaces/projects-filter-config";

@Injectable({
  providedIn: 'root'
})
export class ProjectsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/projects`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: IProjectCreateRequest): Promise<IServerResponse<IProject>> {
    return this._post(this.http, this.root, body);
  }

  get(index: number, size: number, field: string | null, order: string | null,
      search: string | null, filter: string | null = null): Promise<IServerResponse<IProjectsViewModel>> {
    const s = encodeURIComponent(search || '');
    const url = `${this.root}${toQueryString({index, size, field, order, search: s, filter})}`;
    return this._get(this.http, url);
  }

  getByConfig(config: IProjectFilterConfig): Promise<IServerResponse<IProjectsViewModel>> {
    config.search = encodeURIComponent(config.search || '');
    const url = `${this.root}${toQueryString(config)}`;
    return this._get(this.http, url);
  }

  updateDefaultView(projectId: string, tabIndex: number) {
    let defaultview = 'TASK_LIST'
    if(tabIndex === 1) {
      defaultview = 'BOARD';
    };
    const body = {
      project_id: projectId,
      default_view: defaultview
    }
    return this._put(this.http, `${this.root}/update-pinned-view`, body);
  }

  getMyProjectsToTasks(): Promise<IServerResponse<IProject>> {
    const url = `${this.root}/my-task-projects`;
    return this._get(this.http, url);
  }

  getMyProjects(index: number, size: number, field: string | null, order: string | null,
                search: string | null, filter: string | null = null): Promise<IServerResponse<IProjectsViewModel>> {
    const s = encodeURIComponent(search || '');
    const url = `${this.root}/my-projects${toQueryString({index, size, field, order, search: s, filter})}`;
    return this._get(this.http, url);
  }

  getAllTasks(index: number, size: number, field: string | null, order: string | null, search: string | null,
              filter: number | null = null): Promise<IServerResponse<IMyDashboardAllTasksViewModel>> {
    const s = encodeURIComponent(search || '');
    const url = `${this.root}/tasks${toQueryString({index, size, field, order, search: s, filter})}`;
    return this._get(this.http, url);
  }

  getMembers(id: string, index: number, size: number, field: string | null, order: string | null,
             search: string | null): Promise<IServerResponse<IProjectMembersViewModel>> {
    const s = encodeURIComponent(search || '');
    const url = `${this.root}/members/${id}${toQueryString({index, size, field, order, search: s})}`;
    return this._get(this.http, url);
  }

  getById(id: string): Promise<IServerResponse<IProjectViewModel>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  getProjectManager(id: string): Promise<IServerResponse<string>> {
    return this._get(this.http, `${this.root}/project-manager/${id}`);
  }

  update<T>(id: string, body: IProjectCreateRequest): Promise<IServerResponse<IProject>> {
    const q = toQueryString({current_project_id: id})
    return this._put(this.http, `${this.root}/${id}${q}`, body);
  }

  delete(id: string): Promise<IServerResponse<IProject>> {
    return lastValueFrom(this.http.delete<IServerResponse<IProject>>(`${this.root}/${id}`));
  }

  getOverViewById(id: string): Promise<IServerResponse<IProject>> {
    return this._get(this.http, `${this.root}/overview/${id}`);
  }

  getOverViewMembersById(id: string, include_archived: boolean): Promise<IServerResponse<ITeamMemberOverviewGetResponse[]>> {
    return this._get(this.http, `${this.root}/overview-members/${id}?archived=${include_archived}`);
  }

  public getAll(): Promise<IServerResponse<NzTableFilterList>> {
    return this._get(this.http, `${this.root}/all`);
  }

  public toggleFavorite(id: string): Promise<IServerResponse<any>> {
    return this._get(this.http, `${this.root}/favorite/${id}`);
  }

  public toggleArchive(id: string): Promise<IServerResponse<any>> {
    return this._get(this.http, `${this.root}/archive/${id}`);
  }

  public toggleArchiveAll(id: string): Promise<IServerResponse<any>> {
    return this._get(this.http, `${this.root}/archive-all/${id}`);
  }

}
