
export interface IJobType {
    jobId: string;
    jobTitle: string;
    ratePerHour?: number;
  };
export interface JobRoleType extends IJobType {
  members: string[] | null;
}

export interface RatecardType {
  id?: string;
  created_at?: string;
  name?: string;
  jobRolesList?: IJobType[];
  currency?: string;
};

export interface IRatecardViewModel {
  total?: number;
  data?: RatecardType[];
}
