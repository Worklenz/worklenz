import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {lastValueFrom} from "rxjs";
import {IProjectCommentsCreateRequest} from "@interfaces/api-models/project-comment-create-request";
import {IProjectMemberViewModel} from "@interfaces/task-form-view-model";
import {toQueryString} from "@shared/utils";
import {IMentionMemberViewModel} from "@interfaces/project-comments";
import {IProjectUpdateCommentViewModel} from "@interfaces/project";

@Injectable({
  providedIn: 'root'
})
export class ProjectCommentsApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/project-comments`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: IProjectCommentsCreateRequest): Promise<IServerResponse<IProjectCommentsCreateRequest>> {
    return this._post(this.http, `${this.root}`, body);
  }

  getMembers(projectId: string, index: number, size: number, field: string | null, order: string | null, search: string | null): Promise<IServerResponse<IMentionMemberViewModel[]>> {
    const s = encodeURIComponent(search || '');
    const url = `${this.root}/project-members/${projectId}${toQueryString({index, size, field, order, search: s})}`;
    return this._get(this.http, url);
  }

  getCountByProjectId(projectId: string): Promise<IServerResponse<number>> {
    const url = `${this.root}/comments-count/${projectId}`;
    return this._get(this.http, url);
  }

  getByProjectId(projectId: string, isLimit: boolean): Promise<IServerResponse<IProjectUpdateCommentViewModel[]>> {
    const url = `${this.root}/project-comments/${projectId}${toQueryString({latest: isLimit})}`;
    return this._get(this.http, url);
  }

  deleteById(commentId: string): Promise<IServerResponse<string>> {
    const url = `${this.root}/delete/${commentId}`;
    return  this._delete(this.http, url);
  }

}

