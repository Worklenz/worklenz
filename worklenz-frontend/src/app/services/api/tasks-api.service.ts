import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {IBulkAssignMembersRequest, IBulkAssignRequest} from "@interfaces/api-models/bulk-assign-request";
import {IBulkTasksArchiveRequest} from "@interfaces/api-models/bulk-tasks-archive-request";
import {IBulkTasksDeleteRequest} from "@interfaces/api-models/bulk-tasks-delete-request";
import {IBulkTasksDeleteResponse} from "@interfaces/api-models/bulk-tasks-delete-response";
import {IBulkTasksLabelsRequest} from "@interfaces/api-models/bulk-tasks-labels-request";
import {IBulkTasksStatusChangeRequest} from "@interfaces/api-models/bulk-tasks-status-change-request";
import {IMyDashboardAllTasksViewModel} from '@interfaces/api-models/my-dashboard-all-tasks-view-model';
import {IProjectTask, IProjectTasksViewModel} from '@interfaces/api-models/project-tasks-view-model';

import {IServerResponse} from '@interfaces/api-models/server-response';
import {IHomeTaskCreateRequest, ITaskCreateRequest} from '@interfaces/api-models/task-create-request';
import {
  IProjectRoadmapGetRequest,
  ITaskByRangeGetRequest,
  ITaskGetRequest
} from '@interfaces/api-models/task-get-response';
import {ITaskListConfig} from "@interfaces/api-models/task-list-config";
import {ITaskStatusCreateRequest} from '@interfaces/api-models/task-status-create-request';
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {ITask} from '@interfaces/task';
import {ITaskAssigneesUpdateResponse} from "@interfaces/task-assignee-update-response";
import {IHomeTaskViewModel, ITaskFormViewModel} from '@interfaces/task-form-view-model';
import {ITaskListColumn} from "@interfaces/task-list-column";
import {toQueryString} from '@shared/utils';
import {lastValueFrom} from 'rxjs';
import {ITaskListConfigV2, ITaskListGroup} from "../../administrator/modules/task-list-v2/interfaces";

import {APIServiceBase} from './api-service-base';
import {InlineMember} from "@interfaces/api-models/inline-member";
import {
  IPTTask, IPTTaskListColumn,
  IPTTaskListConfig,
  IPTTaskListGroup
} from "../../administrator/settings/project-template-edit-view/interfaces";
import {IBulkTasksPriorityChangeRequest} from "@interfaces/api-models/bulk-tasks-priority-change-request";
import {IBulkTasksPhaseChangeRequest} from "@interfaces/api-models/bulk-tasks-phase-change-request";

@Injectable({
  providedIn: 'root'
})
export class TasksApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/tasks`;

  constructor(private http: HttpClient) {
    super();
  }

  getTasksByTeam(): Promise<IServerResponse<ITaskGetRequest[]>> {
    return this._get(this.http, `${this.root}/team`);
  }

  getTasksByProject(id: string): Promise<IServerResponse<ITaskGetRequest[]>> {
    return this._get(this.http, `${this.root}/project/${id}`);
  }

  getListCols(projectId: string): Promise<IServerResponse<ITaskListColumn[]>> {
    return this._get(this.http, `${this.root}/list/columns/${projectId}`);
  }

  getListColsTest(projectId: string): Promise<IServerResponse<IPTTaskListColumn[]>> {
    return this._get(this.http, `${this.root}/list/columns/${projectId}`);
  }

  toggleListCols(projectId: string, body: ITaskListColumn): Promise<IServerResponse<ITaskListColumn>> {
    return this._put(this.http, `${this.root}/list/columns/${projectId}`, body);
  }

  getTaskList(config: ITaskListConfig | ITaskListConfigV2): Promise<IServerResponse<IProjectTasksViewModel>> {
    const q = toQueryString(config);
    return this._get(this.http, `${this.root}/list/${config.id}${q}`);
  }

  getTaskListV2(config: ITaskListConfigV2): Promise<IServerResponse<ITaskListGroup[] | IProjectTask[]>> {
    const q = toQueryString(config);
    return this._get(this.http, `${this.root}/list/v2/${config.id}${q}`);
  }

  getTaskListV2Test(config: IPTTaskListConfig): Promise<IServerResponse<IPTTaskListGroup[] | IPTTask[]>> {
    const q = toQueryString(config);
    return this._get(this.http, `${this.root}/list/v2-test/${config.id}${q}`);
  }

  getTasksAssignees(projectId: string): Promise<IServerResponse<ITeamMemberViewModel[]>> {
    return this._get(this.http, `${this.root}/assignees/${projectId}`);
  }

  getGanttTasksByProject(project_id: string): Promise<IServerResponse<IProjectRoadmapGetRequest>> {
    return this._get(this.http, `${this.root}/roadmap?project_id=${project_id}`);
  }

  getTasksBetweenRange(project_id: string, start_date: string, end_date: string): Promise<IServerResponse<ITaskByRangeGetRequest>> {
    return this._get(this.http, `${this.root}/range?project_id=${project_id}&start_date=${start_date}&end_date=${end_date}`);
  }

  getTasksByStatus(id: string, status: string): Promise<IServerResponse<IProjectTask[]>> {
    return this._get(this.http, `${this.root}/kanban/${id}?status=${encodeURIComponent(status)}`);
  }

  updateTaskStatus<T>(task_id: string, status_id: string, body: ITaskStatusCreateRequest): Promise<IServerResponse<IProjectTask>> {
    return this._put(this.http, `${this.root}/status/${status_id}/${task_id}`, body);
  }

  create<T>(body: ITaskCreateRequest): Promise<IServerResponse<ITaskFormViewModel>> {
    return this._post(this.http, this.root, body);
  }

  createHomeTask<T>(body: IHomeTaskCreateRequest): Promise<IServerResponse<IHomeTaskViewModel>> {
    return this._post(this.http, `${this.root}/home-task`, body);
  }

  update<T>(body: ITaskCreateRequest, id: string, inline = false): Promise<IServerResponse<ITask>> {
    const q = inline ? "?inline=true" : "";
    return this._put(this.http, `${this.root}/${id}${q}`, body);
  }

  delete(id: string): Promise<IServerResponse<ITaskGetRequest[]>> {
    return lastValueFrom(this.http.delete<IServerResponse<ITaskGetRequest[]>>(`${this.root}/${id}`));
  }

  getFormViewModel(taskId: string | null, projectId: string | null): Promise<IServerResponse<ITaskFormViewModel>> {
    const params = [];
    if (taskId) params.push(`task_id=${taskId}`);
    if (projectId) params.push(`project_id=${projectId}`);
    const q = params.length ? `?${params.join('&')}` : '';
    return this._get(this.http, `${this.root}/info${q}`);
  }

  updateDuration<T>(body: ITaskCreateRequest, id: string): Promise<IServerResponse<ITask>> {
    return this._put(this.http, `${this.root}/duration/${id}`, body);
  }

  createQuickTask<T>(body: ITaskCreateRequest): Promise<IServerResponse<ITask>> {
    return this._post(this.http, `${this.root}/quick-task`, body);
  }

  bulkChangeStatus<T>(body: IBulkTasksStatusChangeRequest, projectId: string): Promise<IServerResponse<ITask>> {
    return this._put(this.http, `${this.root}/bulk/status?project=${projectId}`, body);
  }

  bulkChangePriority<T>(body: IBulkTasksPriorityChangeRequest, projectId: string): Promise<IServerResponse<ITask>>  {
    return this._put(this.http, `${this.root}/bulk/priority?project=${projectId}`, body);
  }

  bulkChangePhase<T>(body: IBulkTasksPhaseChangeRequest, projectId: string): Promise<IServerResponse<ITask>>  {
    return this._put(this.http, `${this.root}/bulk/phase?project=${projectId}`, body);
  }

  bulkDelete<T>(body: IBulkTasksDeleteRequest, projectId: string): Promise<IServerResponse<IBulkTasksDeleteResponse>> {
    return this._put(this.http, `${this.root}/bulk/delete?project=${projectId}`, body);
  }

  bulkArchive<T>(body: IBulkTasksArchiveRequest, unarchive = false): Promise<IServerResponse<string[]>> {
    return this._put(this.http, `${this.root}/bulk/archive?type=${unarchive ? 'unarchive' : 'archive'}&project=${body.project_id}`, body);
  }

  bulkAssignMe<T>(body: IBulkAssignRequest): Promise<IServerResponse<ITaskAssigneesUpdateResponse>> {
    return this._put(this.http, `${this.root}/bulk/assign-me?project=${body.project_id}`, body);
  }

  bulkAssignLabel<T>(body: IBulkTasksLabelsRequest, projectId: string): Promise<IServerResponse<ITask>> {
    return this._put(this.http, `${this.root}/bulk/label?project=${projectId}`, body);
  }

  bulkAssignMembers<T>(body: IBulkAssignMembersRequest): Promise<IServerResponse<ITaskAssigneesUpdateResponse>> {
    return this._put(this.http, `${this.root}/bulk/members?project=${body.project_id}`, body);
  }
  convertToTask<T>(taskId: string, projectId: string): Promise<IServerResponse<IProjectTask>> {
    return this._post(this.http, `${this.root}/convert`, {id: taskId, project_id: projectId});
  }

  convertToSubTask<T>(taskId: string, projectId: string, parentTaskId: string, groupBy: string, toGroupId: string): Promise<IServerResponse<IProjectTask>> {
    return this._post(this.http, `${this.root}/convert-to-subtask`, {
      id: taskId,
      project_id: projectId,
      parent_task_id: parentTaskId,
      group_by: groupBy,
      to_group_id: toGroupId
    });
  }

  getNewKanbanTask<T>(taskId: string): Promise<IServerResponse<IProjectTask>> {
    return this._get(this.http, `${this.root}/get-new-kanban-task/${taskId}`);
  }

  getTaskSubscribers(id: string): Promise<IServerResponse<InlineMember[]>> {
    return this._get(this.http, `${this.root}/subscribers/${id}`);
  }
}
