import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

import {IServerResponse} from '@interfaces/api-models/server-response';
import {ITask} from '@interfaces/task';
import {IProjectTask} from '@interfaces/api-models/project-tasks-view-model';

import {APIServiceBase} from './api-service-base';
import {ITaskTemplatesGetResponse} from "@interfaces/api-models/task-templates-get-response";
import {ITaskTemplateGetResponse} from "@interfaces/api-models/task-template-get-response";
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class TaskTemplatesService extends APIServiceBase {
  private readonly importSbj$ = new Subject<void>();

  private readonly root = `${this.API_BASE_URL}/task-templates`;

  public get onTemplateImport() {
    return this.importSbj$.asObservable();
  }

  constructor(private http: HttpClient) {
    super();
  }

  get(): Promise<IServerResponse<ITaskTemplatesGetResponse[]>> {
    return this._get(this.http, this.root);
  }

  getById(id: string): Promise<IServerResponse<ITaskTemplateGetResponse>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  createTemplate<T>(body: { name: string, tasks: IProjectTask[] }): Promise<IServerResponse<ITask>> {
    return this._post(this.http, `${this.root}`, body);
  }

  updateTemplate<T>(id: string, body: { name: string, tasks: IProjectTask[] }): Promise<IServerResponse<IProjectTask>> {
    return this._put(this.http, `${this.root}/${id}`, body);
  }

  delete<T>(id: string): Promise<IServerResponse<any>> {
    return this._delete(this.http, `${this.root}/${id}`);
  }

  import<T>(id: string, body: IProjectTask[]): Promise<IServerResponse<ITask>> {
    return this._post(this.http, `${this.root}/import/${id}`, body);
  }

  public emitOnImport() {
    this.importSbj$.next();
  }
}
