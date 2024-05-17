import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {lastValueFrom} from "rxjs";
import {IProjectMemberViewModel} from "@interfaces/task-form-view-model";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class ProjectMembersApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/project-members`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: IProjectMemberViewModel): Promise<IServerResponse<IProjectMemberViewModel>> {
    const q = toQueryString({current_project_id: body.project_id});
    return this._post(this.http, `${this.root}${q}`, body);
  }

  createByEmail<T>(body: { project_id: string; email: string; }): Promise<IServerResponse<IProjectMemberViewModel>> {
    return this._post(this.http, `${this.root}/invite`, body);
  }

  getByProjectId(id: string): Promise<IServerResponse<IProjectMemberViewModel[]>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  deleteById(id: string, currentProjectId: string): Promise<IServerResponse<IProjectMemberViewModel>> {
    const q = toQueryString({current_project_id: currentProjectId})
    return lastValueFrom(this.http.delete<IServerResponse<IProjectMemberViewModel>>(`${this.root}/${id}${q}`));
  }
}
