import { ReactNode } from 'react';

// temp type for clients object this shold be replaced with actual type ========================
export type TempClientPortalClientType = {
  id: string;
  name: string;
  assigned_projects_count: number;
  projects: any[];
  team_members: any[];
};

// temp type for requests object this shold be replaced with actual type ========================
export type TempRequestsType = {
  id: string;
  req_no: string;
  service: string;
  client: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  time: Date;
};

// temp type for services object this shold be replaced with actual type ========================
export type TempRequestFromItemType = {
  question: string;
  type: 'text' | 'multipleChoice' | 'attachment';
  answer: string | string[] | null;
};

export type TempServicesType = {
  id: string;
  name: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  created_by?: string;
  service_data?: {
    description?: ReactNode | string;
    images?: string[] | null;
    request_form?: TempRequestFromItemType[];
  };
  no_of_requests?: number;
};
