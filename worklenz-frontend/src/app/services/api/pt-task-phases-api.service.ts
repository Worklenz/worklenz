import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ITaskPhase} from "@interfaces/api-models/task-phase";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class PtTaskPhasesApiService extends APIServiceBase {

  private readonly root = `${this.API_BASE_URL}/pt-task-phases`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create(projectId: string): Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({id: projectId})
    return this._post(this.http, `${this.root}${q}`, {});
  }

  get(projectId: string): Promise<IServerResponse<ITaskPhase[]>> {
    const q = toQueryString({id: projectId})
    return this._get(this.http, `${this.root}${q}`);
  }

  getById(id: string, projectId: string): Promise<IServerResponse<ITaskPhase[]>> {
    const q = toQueryString({id: projectId})
    return this._get(this.http, `${this.root}/${id}${q}`);
  }

  updateLabel(projectId: string, name: string): Promise<IServerResponse<ITaskPhase>> {
    return this._put(this.http, `${this.root}/label/${projectId}`, {name});
  }

  update(projectId: string, body: ITaskPhase): Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({id: projectId})
    return this._put(this.http, `${this.root}/${body.id}${q}`, body);
  }

   updateColor(templateId: string, body: ITaskPhase) : Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({id: templateId, current_project_id: templateId})
    return this._put(this.http, `${this.root}/change-color/${body.id}${q}`, body);
  }

  delete(id: string, projectId: string): Promise<IServerResponse<ITaskPhase>> {
    const q = toQueryString({id: projectId})
    return this._delete(this.http, `${this.root}/${id}${q}`);
  }

}
