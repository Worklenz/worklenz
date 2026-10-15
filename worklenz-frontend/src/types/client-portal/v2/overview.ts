import type { ApprovalStatus } from './approvals';
import type { ChangeRequestPriority, ChangeRequestStatus } from './change-requests';

/** Every widget the staff Overview can show. Keep in sync with OVERVIEW_WIDGET_KEYS in the backend. */
export const OVERVIEW_WIDGET_KEYS = [
  'kpi_awaiting_approvals',
  'kpi_open_change_requests',
  'kpi_delayed_milestones',
  'kpi_unread_discussions',
  'kpi_overdue_invoices',
  'pending_approvals',
  'change_requests',
  'upcoming_milestones',
  'latest_discussions',
  'mentions_me',
  'approvals_by_status',
  'cr_by_status',
  'needs_attention',
] as const;

export type OverviewWidgetKey = (typeof OVERVIEW_WIDGET_KEYS)[number];

export type OverviewWidgetSize = 's' | 'm' | 'l';

/** Legacy saved shape (ordered list with S/M/L sizes). Still accepted on read and converted to the grid layout. */
export interface OverviewLayoutItem {
  key: OverviewWidgetKey;
  size: OverviewWidgetSize;
  visible: boolean;
}

/** One widget on the 12-column grid. */
export interface OverviewWidgetInstance {
  key: OverviewWidgetKey;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
}

export interface OverviewLayout {
  version: 1;
  widgets: OverviewWidgetInstance[];
}

export interface OverviewLayoutResponse {
  /** null until the user customises: the page falls back to its default layout. */
  layout: OverviewLayout | OverviewLayoutItem[] | null;
  version: number;
}

export interface OverviewAttentionItem {
  kind: 'approval_overdue' | 'change_request_review' | 'milestone_late';
  label: string;
  detail: string;
  at: string | null;
  target: { type: 'approval' | 'change_request' | 'project'; id: string };
}

export interface OverviewWidgetData {
  kpi_awaiting_approvals: { awaiting: number; overdue: number };
  kpi_open_change_requests: { needs_review: number; waiting_on_client: number };
  kpi_delayed_milestones: { delayed: number };
  kpi_unread_discussions: { unread: number };
  kpi_overdue_invoices: { count: number; by_currency: Array<{ currency: string; amount: number }> };
  pending_approvals: {
    items: Array<{
      id: string;
      ref_no: string;
      title: string;
      organization_name: string;
      project_name: string;
      approver_name: string;
      due_date: string | null;
      is_overdue: boolean;
    }>;
    total: number;
  };
  change_requests: {
    items: Array<{
      id: string;
      cr_no: string;
      title: string;
      organization_name: string;
      project_name: string;
      priority: ChangeRequestPriority;
      status: ChangeRequestStatus;
      submitted_at: string;
    }>;
    total: number;
  };
  upcoming_milestones: {
    items: Array<{
      id: string;
      project_id: string;
      name: string;
      target_date: string;
      status: string;
      is_late: boolean;
      project_name: string;
      project_color: string | null;
      organization_name: string | null;
    }>;
  };
  latest_discussions: {
    items: Array<{
      id: string;
      ref_no: string;
      organization_name: string;
      project_name: string;
      context_label: string;
      unread: boolean;
      last_text: string;
      last_at: string;
    }>;
    total: number;
  };
  mentions_me: {
    items: Array<{
      id: string;
      thread_id: string;
      author_name: string;
      excerpt: string;
      at: string;
      project_id: string;
      project_name: string;
      unread: boolean;
    }>;
  };
  approvals_by_status: Record<Extract<ApprovalStatus, 'awaiting' | 'approved' | 'changes_requested'>, number>;
  cr_by_status: { items: Array<{ status: ChangeRequestStatus; count: number }> };
  needs_attention: { items: OverviewAttentionItem[] };
}

/** One widget's block in the overview response: its data, or why it failed. */
export type OverviewWidgetResult<K extends OverviewWidgetKey> = { data: OverviewWidgetData[K] } | { error: string };

export type OverviewResponse = { [K in OverviewWidgetKey]?: OverviewWidgetResult<K> };
