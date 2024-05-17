import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {lastValueFrom} from "rxjs";
import {IProjectFolder} from "@interfaces/project-folder";

@Injectable({
  providedIn: 'root'
})
export class ProjectFoldersApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/projects-folders`;

  constructor(
    private readonly http: HttpClient
  ) {
    super();
  }

  create<T>(body: { name: string; color_code?: string; }): Promise<IServerResponse<IProjectFolder>> {
    return this._post(this.http, this.root, body);
  }

  get(): Promise<IServerResponse<IProjectFolder[]>> {
    return this._get(this.http, `${this.root}`);
  }

  getById(id: string): Promise<IServerResponse<IProjectFolder>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  update<T>(id: string, body: IProjectFolder): Promise<IServerResponse<IProjectFolder>> {
    return this._put(this.http, `${this.root}/${id}`, body);
  }

  delete(id: string): Promise<IServerResponse<IProjectFolder>> {
    return lastValueFrom(this.http.delete<IServerResponse<IProjectFolder>>(`${this.root}/${id}`));
  }
}
