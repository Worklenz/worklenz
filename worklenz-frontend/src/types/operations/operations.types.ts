export type OperationalCaseType = 'supplier_order' | 'repair' | 'shipment' | 'general';

export type OperationalCaseStatus =
  | 'new'
  | 'waiting_internal'
  | 'waiting_external'
  | 'in_progress'
  | 'at_risk'
  | 'overdue'
  | 'done'
  | 'closed_problem';

export interface IMoneyImpact {
  currency?: string | null;
  object_value?: number | null;
  service_cost?: number | null;
  potential_loss?: number | null;
  downtime_cost_per_day?: number | null;
  delay_cost_per_day?: number | null;
}

export interface IOperationalCase {
  id: string;
  team_id?: string;
  title: string;
  order_number?: string | null;
  description?: string | null;
  case_type: OperationalCaseType;
  status: OperationalCaseStatus;
  project_name?: string | null;
  counterparty_name?: string | null;
  counterparty_type?: string | null;
  asset_name?: string | null;
  asset_inventory_no?: string | null;
  due_date?: string | null;
  next_action_text?: string | null;
  next_action_due_date?: string | null;
  external_wait_since?: string | null;
  last_activity_at?: string | null;
  priority_score?: number | null;
  risk_score?: number | null;
  no_deadline_reason?: string | null;
  money_currency?: string | null;
  money_impact?: IMoneyImpact;
  money_impact_total?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface IOperationalCasesResponse {
  total: number;
  data: IOperationalCase[];
}
