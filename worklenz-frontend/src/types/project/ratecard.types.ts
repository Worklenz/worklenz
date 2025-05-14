import { JobType } from "./job.types";


export interface JobRoleType extends JobType {
  members: string[] | null;
}

export type RatecardType = {
  ratecardId: string;
  ratecardName: string;
  jobRolesList: JobType[];
  createdDate: Date;
  currency?: string;
};
