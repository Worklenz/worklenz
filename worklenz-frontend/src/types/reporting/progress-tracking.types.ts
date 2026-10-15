export type DeliveryConfidence = 'green' | 'amber' | 'red';

export type DeliveryConfidenceFilter = 'all' | DeliveryConfidence | 'unset';

export type ProgressTrackingPercentRange =
  | 'no_tasks'
  | '0_25'
  | '26_50'
  | '51_75'
  | '76_100';

export interface IProgressTrackingProject {
  id: string;
  name: string;
  color_code: string | null;
  client_name: string | null;
  manager: string | null;
  start_date: string | null;
  end_date: string | null;
  total_tasks: number;
  done_tasks: number;
  percent_complete: number | null;
  blocked_count: number;
  confidence: DeliveryConfidence | null;
  confidence_note: string | null;
  confidence_updated_at: string | null;
  confidence_updated_by_name: string | null;
  can_edit: boolean;
}

export interface IProgressTrackingSummary {
  total: number;
  on_track: number;
  at_risk: number;
  off_track: number;
  not_set: number;
  archived_excluded: number;
}

export interface IProgressTrackingList {
  projects: IProgressTrackingProject[];
  total: number;
  page: number;
  page_size: number;
  summary: IProgressTrackingSummary;
  clients: { id: string; name: string }[];
  managers: { id: string; name: string }[];
}

export interface IProgressTrackingQuery {
  search?: string;
  client_ids?: string[];
  manager_ids?: string[];
  confidence?: (DeliveryConfidence | 'unset')[];
  percent_range?: ProgressTrackingPercentRange[];
  has_blockers?: boolean;
  include_archived?: boolean;
  field?:
    | 'name'
    | 'client'
    | 'percent'
    | 'blocked'
    | 'confidence'
    | 'updated'
    | 'manager'
    | 'start_date'
    | 'end_date';
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface IDeliveryConfidenceDetails {
  confidence: DeliveryConfidence | null;
  confidence_note: string | null;
  confidence_updated_at: string | null;
  confidence_updated_by_name: string | null;
}

export interface IUpdateDeliveryConfidenceRequest {
  status?: DeliveryConfidence | null;
  note?: string | null;
}

export interface IUpdateDeliveryConfidenceResponse {
  id: string;
  confidence: DeliveryConfidence | null;
  confidence_note: string | null;
  confidence_updated_at: string | null;
  confidence_updated_by_name: string | null;
  can_edit: boolean;
}
