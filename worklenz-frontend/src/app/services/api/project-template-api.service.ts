import {Injectable} from '@angular/core';
import {APIServiceBase} from "@api/api-service-base";
import {HttpClient} from "@angular/common/http";
import {IServerResponse} from "@interfaces/api-models/server-response";
import {ICustomProjectTemplateCreateRequest} from "@interfaces/project-template";
import {lastValueFrom} from "rxjs";
import {IProjectTemplate, IWorklenzTemplate} from "@interfaces/api-models/project-template";
import {
  IAccountSetupRequest,
  IAccountSetupResponse
} from "../../administrator/account-setup/account-setup/account-setup.component";

@Injectable({
  providedIn: 'root'
})
export class ProjectTemplateApiService extends APIServiceBase {
  private readonly root = `${this.API_BASE_URL}/project-templates`;

  constructor(
    private http: HttpClient
  ) {
    super();
  }

  createCustomTemplate(body: ICustomProjectTemplateCreateRequest): Promise<IServerResponse<any>> {
    return this._post(this.http, `${this.root}/custom-template`, body);
  }

  createFromTemplate(body: { template_id: string }): Promise<IServerResponse<any>> {
    return this._post(this.http, `${this.root}/import-template`, body);
  }

  createFromCustomTemplate(body: { template_id: string }): Promise<IServerResponse<any>> {
    return this._post(this.http, `${this.root}/import-custom-template`, body);
  }

  createTemplates(): Promise<IServerResponse<any>> {
    return this._get(this.http, `${this.root}/create`);
  }

  getWorklenzTemplates(): Promise<IServerResponse<IWorklenzTemplate[]>> {
    return this._get(this.http, `${this.root}/worklenz-templates`);
  }

  getWorklenzTemplateById(templateId: string): Promise<IServerResponse<IProjectTemplate>> {
    return this._get(this.http, `${this.root}/worklenz-templates/${templateId}`);
  }

  getWorklenzCustomTemplates(): Promise<IServerResponse<IWorklenzTemplate[]>> {
    return this._get(this.http, `${this.root}/custom-templates`);
  }

  delete(id: string): Promise<IServerResponse<any>> {
    return lastValueFrom(this.http.delete<IServerResponse<any>>(`${this.root}/${id}`));
  }

  setupAccount<T>(body: IAccountSetupRequest): Promise<IServerResponse<IAccountSetupResponse>> {
    return this._post(this.http, `${this.root}/setup`, body);
  }

}
