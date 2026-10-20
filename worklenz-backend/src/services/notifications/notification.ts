export declare type Params = {
  [key: string]: any;
};

export default class WorklenzNotification {
  private team: string;
  private team_id: string;
  private message: string;
  private url: string | null;
  private project?: string;
  private color?: string;
  private params?: Params;
  private task_id?: string;
  private project_id?: string;
  private message_key?: string;
  private message_params?: Params;
  private notification_type_key?: string;

  constructor(teamName: string, teamId: string, message: string, url: string | null) {
    this.team = teamName;
    this.team_id = teamId;
    this.message = message;
    this.url = url;
  }

  public setTranslation(key: string, params?: Params, typeKey?: string) {
    this.message_key = key;
    this.message_params = params;
    this.notification_type_key = typeKey;
  }

  public setProject(name: string) {
    this.project = name;
  }

  public setColor(code: string) {
    this.color = code;
  }

  public setParams(params: Params) {
    this.params = params;
  }

  public setTaskId(id: string) {
    this.task_id = id;
  }

  public setProjectId(id: string) {
    this.project_id = id;
  }
}
