export interface IClient {
  id?: string;
  name?: string;
  team_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IClientViewModel extends IClient {
  projects_count?: number;
}

export interface IClientsViewModel {
  total?: number;
  data?: IClientViewModel[];
}
