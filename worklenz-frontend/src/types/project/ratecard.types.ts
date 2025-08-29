export interface IJobType {
  id?: string;
  jobId?: string;
  jobtitle?: string;
  ratePerHour?: number;
  rate_card_id?: string;
  job_title_id?: string;
  rate?: number;
  man_day_rate?: number;
  name?: string;
}
export interface JobRoleType extends IJobType {
  members?: string[] | null;
}

export interface RatecardType {
  id?: string;
  created_at?: string;
  name?: string;
  jobRolesList?: IJobType[];
  currency?: string;
}

export interface IRatecardViewModel {
  total?: number;
  data?: RatecardType[];
}

export interface IProjectRateCardRole {
  project_id: string;
  roles: IJobType[];
}
