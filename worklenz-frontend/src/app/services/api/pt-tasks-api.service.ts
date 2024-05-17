import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {
  IPTTask,
  IPTTaskListColumn,
  IPTTaskListConfig,
  IPTTaskListGroup
} from "../../administrator/settings/project-template-edit-view/interfaces";
import {toQueryString} from "@shared/utils";
import {ITaskStatusCreateRequest} from "@interfaces/api-models/task-status-create-request";
import {ITaskCreateRequest} from "@interfaces/api-models/task-create-request";
import {ITaskFormViewModel} from "@interfaces/task-form-view-model";
import {ITaskGetRequest} from "@interfaces/api-models/task-get-response";
import {lastValueFrom} from "rxjs";
import {IBulkTasksStatusChangeRequest} from "@interfaces/api-models/bulk-tasks-status-change-request";
import {IBulkTasksDeleteRequest} from "@interfaces/api-models/bulk-tasks-delete-request";
import {IBulkTasksDeleteResponse} from "@interfaces/api-models/bulk-tasks-delete-response";

@Injectable({
  providedIn: 'root'
})
export class PtTasksApiService extends APIServiceBase {

  private readonly root = `${this.API_BASE_URL}/pt-tasks`;

  constructor(private http: HttpClient) {
    super();
  }

  getTaskList(config: IPTTaskListConfig): Promise<IServerResponse<IPTTaskListGroup[] | IPTTask[]>> {
    const q = toQueryString(config);
    return this._get(this.http, `${this.root}/list/${config.id}${q}`);
  }

  bulkDelete<T>(body: IBulkTasksDeleteRequest, templateId: string): Promise<IServerResponse<IBulkTasksDeleteResponse>> {
    return this._put(this.http, `${this.root}/bulk/delete`, body);
  }

}
