export type BudgetAlert = 'high' | 'watch' | 'ok' | 'none';

export interface BudgetTrackingFilters {
  project_ids?: string[];
  member_ids?: string[];
  team_ids?: string[];
}

export interface BudgetTrackingRow {
  project_id: string;
  project_name: string;
  color_code: string;
  client_name: string | null;
  currency: string;
  budget: number;
  spent: number;
  remaining: number;
  burn_pct: number;
  alert: BudgetAlert;
  has_budget: boolean;
}

export interface BudgetTrackingKpis {
  total_budget: number;
  spent: number;
  remaining: number;
  over_budget_count: number;
  utilization_pct: number;
}

export interface BudgetTrackingSeriesResponse {
  projects: BudgetTrackingRow[];
  kpis: BudgetTrackingKpis;
  meta: {
    project_count: number;
  };
  last_updated_at: string;
}
