import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton, theme } from '@/shared/antd-imports';
import { portalPaths } from '@/pages/client-portal/portal-paths';
import type { ChangeRequestStatus } from '@/types/client-portal/v2/change-requests';
import { OVERVIEW_NS, resolveStatus, WidgetFrame, type WidgetProps } from './WidgetFrame';

const OverviewDoughnut = React.lazy(() =>
  import('./OverviewCharts').then(module => ({ default: module.OverviewDoughnut }))
);
const OverviewBars = React.lazy(() =>
  import('./OverviewCharts').then(module => ({ default: module.OverviewBars }))
);

const Fallback = () => <Skeleton active paragraph={{ rows: 4 }} title={false} />;

export const ApprovalsByStatusWidget = ({ result, loading, onRetry }: WidgetProps<'approvals_by_status'>) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const { token } = theme.useToken();
  const title = t('widgets.approvals_by_status.title', { defaultValue: 'Approvals by status' });

  return (
    <WidgetFrame
      title={title}
      viewAllTo={portalPaths.approvals}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      isEmpty={d => d.awaiting + d.approved + d.changes_requested === 0}
      emptyText={t('widgets.approvals_by_status.empty', { defaultValue: 'No approvals have been sent yet.' })}
    >
      {d => (
        <Suspense fallback={<Fallback />}>
          <OverviewDoughnut
            ariaLabel={title}
            data={[
              {
                label: t('status.awaiting', { defaultValue: 'Awaiting' }),
                value: d.awaiting,
                color: token.colorWarning,
              },
              {
                label: t('status.approved', { defaultValue: 'Approved' }),
                value: d.approved,
                color: token.colorSuccess,
              },
              {
                label: t('status.changes_requested', { defaultValue: 'Changes requested' }),
                value: d.changes_requested,
                color: token.colorError,
              },
            ]}
          />
        </Suspense>
      )}
    </WidgetFrame>
  );
};

const CR_STATUS_ORDER: ChangeRequestStatus[] = [
  'submitted',
  'under_review',
  'more_info',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];

const CR_LABELS: Record<ChangeRequestStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  more_info: 'More info',
  approved: 'Approved',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const ChangeRequestsByStatusWidget = ({ result, loading, onRetry }: WidgetProps<'cr_by_status'>) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const { token } = theme.useToken();
  const title = t('widgets.cr_by_status.title', { defaultValue: 'Change request pipeline' });

  const colorFor = (status: ChangeRequestStatus) =>
    status === 'completed' || status === 'approved'
      ? token.colorSuccess
      : status === 'under_review' || status === 'more_info'
        ? token.colorWarning
        : status === 'rejected' || status === 'cancelled'
          ? token.colorTextQuaternary
          : token.colorPrimary;

  return (
    <WidgetFrame
      title={title}
      viewAllTo={portalPaths.changeRequests}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      isEmpty={d => d.items.length === 0}
      emptyText={t('widgets.cr_by_status.empty', { defaultValue: 'No change requests yet.' })}
    >
      {({ items }) => {
        const counts = new Map(items.map(item => [item.status, item.count]));
        return (
          <Suspense fallback={<Fallback />}>
            <OverviewBars
              ariaLabel={title}
              data={CR_STATUS_ORDER.map(status => ({
                label: t(`status.cr_${status}`, { defaultValue: CR_LABELS[status] }),
                value: counts.get(status) ?? 0,
                color: colorFor(status),
              }))}
            />
          </Suspense>
        );
      }}
    </WidgetFrame>
  );
};
