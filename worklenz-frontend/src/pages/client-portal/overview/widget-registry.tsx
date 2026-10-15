import React from 'react';
import type { OverviewWidgetKey } from '@/types/client-portal/v2/overview';
import type { WidgetProps } from './widgets/WidgetFrame';
import {
  AwaitingApprovalsKpi,
  DelayedMilestonesKpi,
  OpenChangeRequestsKpi,
  OverdueInvoicesKpi,
  UnreadDiscussionsKpi,
} from './widgets/KpiWidgets';
import {
  ChangeRequestsWidget,
  LatestDiscussionsWidget,
  MentionsMeWidget,
  NeedsAttentionWidget,
  PendingApprovalsWidget,
  UpcomingMilestonesWidget,
} from './widgets/ListWidgets';
import { ApprovalsByStatusWidget, ChangeRequestsByStatusWidget } from './widgets/ChartWidgets';

type WidgetComponents = { [K in OverviewWidgetKey]: React.ComponentType<WidgetProps<K>> };

const WIDGET_COMPONENTS: WidgetComponents = {
  kpi_awaiting_approvals: AwaitingApprovalsKpi,
  kpi_open_change_requests: OpenChangeRequestsKpi,
  kpi_delayed_milestones: DelayedMilestonesKpi,
  kpi_unread_discussions: UnreadDiscussionsKpi,
  kpi_overdue_invoices: OverdueInvoicesKpi,
  pending_approvals: PendingApprovalsWidget,
  change_requests: ChangeRequestsWidget,
  upcoming_milestones: UpcomingMilestonesWidget,
  latest_discussions: LatestDiscussionsWidget,
  mentions_me: MentionsMeWidget,
  approvals_by_status: ApprovalsByStatusWidget,
  cr_by_status: ChangeRequestsByStatusWidget,
  needs_attention: NeedsAttentionWidget,
};

/** Default English title of each widget, used for the edit-mode bar and as the i18n defaultValue. */
export const WIDGET_TITLES: Record<OverviewWidgetKey, string> = {
  kpi_awaiting_approvals: 'Pending approvals',
  kpi_open_change_requests: 'Change requests to review',
  kpi_delayed_milestones: 'Delayed milestones',
  kpi_unread_discussions: 'Unread discussions',
  kpi_overdue_invoices: 'Overdue invoices',
  pending_approvals: 'Pending approvals',
  change_requests: 'Change requests to review',
  upcoming_milestones: 'Upcoming milestones',
  latest_discussions: 'Latest discussions',
  mentions_me: 'Mentions of me',
  approvals_by_status: 'Approvals by status',
  cr_by_status: 'Change request pipeline',
  needs_attention: 'Needs attention',
};

/** Renders one widget by key. The registry is typed per key; the grid only ever has a key at runtime. */
export const WidgetByKey = ({
  widgetKey,
  ...props
}: WidgetProps<OverviewWidgetKey> & { widgetKey: OverviewWidgetKey }) => {
  const Component = WIDGET_COMPONENTS[widgetKey] as unknown as React.ComponentType<WidgetProps<OverviewWidgetKey>>;
  return <Component {...props} />;
};
