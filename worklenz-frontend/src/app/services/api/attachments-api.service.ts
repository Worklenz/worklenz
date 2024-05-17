import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {lastValueFrom} from "rxjs";
import {ITaskAttachment} from "@interfaces/api-models/task-attachment";
import {
  IProjectAttachmentsViewModel,
  ITaskAttachmentViewModel
} from "@interfaces/api-models/task-attachment-view-model";
import {IAvatarAttachment} from "@interfaces/avatar-attachment";
import {toQueryString} from "@shared/utils";

@Injectable({
  providedIn: 'root'
})
export class AttachmentsApiService extends APIServiceBase {
  constructor(
    private http: HttpClient
  ) {
    super();
  }

  createTaskAttachment<T>(body: ITaskAttachment): Promise<IServerResponse<ITaskAttachmentViewModel>> {
    return this._post(this.http, `${this.API_BASE_URL}/attachments/tasks`, body);
  }

  createAvatarAttachment<T>(body: IAvatarAttachment): Promise<IServerResponse<{ url: string; }>> {
    return this._post(this.http, `${this.API_BASE_URL}/attachments/avatar`, body);
  }

  getTaskAttachment<T>(taskId: string): Promise<IServerResponse<ITaskAttachmentViewModel[]>> {
    return this._get(this.http, `${this.API_BASE_URL}/attachments/tasks/${taskId}`);
  }

  getProjectAttachment<T>(projectId: string, index: number, size: number ): Promise<IServerResponse<IProjectAttachmentsViewModel>> {
    return this._get(this.http, `${this.API_BASE_URL}/attachments/project/${projectId}${toQueryString({index, size})}`);
  }

  deleteTaskAttachment<T>(id: string): Promise<IServerResponse<ITaskAttachmentViewModel[]>> {
    return lastValueFrom(this.http.delete<IServerResponse<ITaskAttachmentViewModel[]>>(`${this.API_BASE_URL}/attachments/tasks/${id}`));
  }

  download<T>(id: string, filename: string): Promise<IServerResponse<any>> {
    return this._get(this.http, `${this.API_BASE_URL}/attachments/download?id=${id}&file=${filename}`);
  }
}
