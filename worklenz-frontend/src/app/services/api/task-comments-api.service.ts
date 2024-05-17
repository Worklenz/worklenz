import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {lastValueFrom} from "rxjs";
import {ITaskCommentsCreateRequest} from "@interfaces/api-models/task-comments-create-request.ts";
import {ITaskCommentViewModel} from "@interfaces/api-models/task-comment-view-model";
import {ITaskComment} from "@interfaces/task-comment";

@Injectable({
  providedIn: 'root'
})
export class TaskCommentsApiService extends APIServiceBase {
  constructor(
    private http: HttpClient
  ) {
    super();
  }

  create<T>(body: ITaskCommentsCreateRequest): Promise<IServerResponse<ITaskCommentsCreateRequest>> {
    return this._post(this.http, `${this.API_BASE_URL}/task-comments`, body);
  }

  getByTaskId(id: string): Promise<IServerResponse<ITaskCommentViewModel[]>> {
    return this._get(this.http, `${this.API_BASE_URL}/task-comments/${id}`);
  }

  update<T>(id: string, body: ITaskComment): Promise<IServerResponse<ITaskComment>> {
    return this._put(this.http, `${this.API_BASE_URL}/task-comments/${id}`, body);
  }

  delete(id: string, taskId: string): Promise<IServerResponse<ITaskComment>> {
    return lastValueFrom(this.http.delete<IServerResponse<ITaskComment>>(`${this.API_BASE_URL}/task-comments/${id}/${taskId}`));
  }
}
