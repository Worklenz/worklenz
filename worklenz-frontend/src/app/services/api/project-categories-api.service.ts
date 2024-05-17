import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {IProjectCategory, IProjectCategoryViewModel} from "@interfaces/project-category";
import {ITaskLabel} from "@interfaces/task-label";

@Injectable({
  providedIn: 'root'
})
export class ProjectCategoriesApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/project-categories`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: IProjectCategory): Promise<IServerResponse<IProjectCategory>> {
    return this._post(this.http, this.root, body);
  }

  get(): Promise<IServerResponse<IProjectCategory[]>> {
    return this._get(this.http, `${this.root}`);
  }

  getByTeamId(id: string): Promise<IServerResponse<IProjectCategoryViewModel[]>> {
    return this._get(this.http, `${this.root}/${id}`);
  }

  getByOrg(): Promise<IServerResponse<IProjectCategoryViewModel[]>> {
    return this._get(this.http, `${this.root}/org-categories`);
  }

  updateColor<T>(id: string, color: string): Promise<IServerResponse<ITaskLabel[]>> {
    return this._put(this.http, `${this.root}/${id}`, {color});
  }

  deleteById<T>(id: string): Promise<IServerResponse<void>> {
    return this._delete(this.http, `${this.root}/${id}`);
  }
}

