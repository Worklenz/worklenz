import {IClient} from "../client";

export interface IClientViewModel extends IClient {
  projects_count?: number;
}
