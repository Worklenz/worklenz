import {IProject} from "../project";

export interface IProjectCreateRequest extends IProject {
  client_name?: string | null;
  status_id?: string;
}
