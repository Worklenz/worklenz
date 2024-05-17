import {Injectable} from '@angular/core';
import {IServerResponse} from "@interfaces/api-models/server-response";
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IEventMarker, IGanttRoadMapTask, IProjectPhaseLabel} from "@interfaces/api-models/gantt";

@Injectable({
  providedIn: 'root'
})
export class GanttApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/gantt`;

  constructor(private http: HttpClient) {
    super();
  }

  getGanttTasksByProject(project_id: string): Promise<IServerResponse<IGanttRoadMapTask[]>> {
    return this._get(this.http, `${this.root}/project-roadmap?project_id=${project_id}`);
  }

  getProjectPhaseLabel(project_id: string): Promise<IServerResponse<IProjectPhaseLabel>> {
    return this._get(this.http, `${this.root}/project-phase-label?project_id=${project_id}`);
  }

  getProjectPhases(project_id: string): Promise<IServerResponse<IEventMarker[]>> {
    return this._get(this.http, `${this.root}/project-phases/${project_id}`);
  }

  getWorkloadData(project_id: string): Promise<IServerResponse<IGanttRoadMapTask[]>> {
    return this._get(this.http, `${this.root}/project-workload?project_id=${project_id}`);
  }
}
