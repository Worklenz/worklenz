import React from 'react';
import { useTranslation } from 'react-i18next';
import { portalPaths } from '@/pages/client-portal/portal-paths';
import { StatusTag } from '@/components/client-portal/v2/StatusTag';
import { PriorityTag } from '@/components/client-portal/v2/portal-tags';
import { formatPortalDate, formatRelativeTime } from '@/components/client-portal/v2/format';
import { OVERVIEW_NS, resolveStatus, WidgetFrame, WidgetRow, type WidgetProps } from './WidgetFrame';
import { decodeHtmlEntities } from '@/utils/html-entities';

export const PendingApprovalsWidget = ({ result, loading, onRetry }: WidgetProps<'pending_approvals'>) => {
  const { t, i18n } = useTranslation(OVERVIEW_NS);
  return (
    <WidgetFrame
      title={t('widgets.pending_approvals.title', { defaultValue: 'Pending approvals' })}
      viewAllTo={portalPaths.approvals}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      isEmpty={data => data.items.length === 0}
      emptyText={t('widgets.pending_approvals.empty', { defaultValue: 'No approvals are waiting on a client.' })}
    >
      {({ items }) =>
        items.map(item => (
          <WidgetRow
            key={item.id}
            to={portalPaths.approval(item.id)}
            title={`${item.ref_no} · ${item.title}`}
            subtitle={`${item.organization_name} · ${item.approver_name}`}
            right={
              item.due_date ? (
                <StatusTone overdue={item.is_overdue}>
                  {item.is_overdue
                    ? t('widgets.pending_approvals.overdue', {
                        date: formatPortalDate(item.due_date, i18n.language),
                        defaultValue: 'Overdue · {{date}}',
                      })
                    : t('widgets.pending_approvals.due', {
                        date: formatPortalDate(item.due_date, i18n.language),
                        defaultValue: 'Due {{date}}',
                      })}
                </StatusTone>
              ) : null
            }
          />
        ))
      }
    </WidgetFrame>
  );
};

const StatusTone = ({ overdue, children }: { overdue: boolean; children: React.ReactNode }) => (
  <StatusTag tone={overdue ? 'red' : 'gray'}>{children}</StatusTag>
);

export const ChangeRequestsWidget = ({ result, loading, onRetry }: WidgetProps<'change_requests'>) => {
  const { t, i18n } = useTranslation(OVERVIEW_NS);
  return (
    <WidgetFrame
      title={t('widgets.change_requests.title', { defaultValue: 'Change requests to review' })}
      viewAllTo={portalPaths.changeRequests}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      isEmpty={data => data.items.length === 0}
      emptyText={t('widgets.change_requests.empty', { defaultValue: 'No change requests need review.' })}
    >
      {({ items }) =>
        items.map(item => (
          <WidgetRow
            key={item.id}
            to={portalPaths.changeRequest(item.id)}
            title={`${item.cr_no} · ${item.title}`}
            subtitle={`${item.organization_name} · ${formatRelativeTime(item.submitted_at, i18n.language) ?? ''}`}
            right={<PriorityTag priority={item.priority} />}
          />
        ))
      }
    </WidgetFrame>
  );
};

export const UpcomingMilestonesWidget = ({ result, loading, onRetry }: WidgetProps<'upcoming_milestones'>) => {
  const { t, i18n } = useTranslation(OVERVIEW_NS);
  return (
    <WidgetFrame
      title={t('widgets.upcoming_milestones.title', { defaultValue: 'Upcoming milestones' })}
      viewAllTo={portalPaths.projects}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      isEmpty={data => data.items.length === 0}
      emptyText={t('widgets.upcoming_milestones.empty', { defaultValue: 'No open milestones on portal projects.' })}
    >
      {({ items }) =>
        items.map(item => (
          <WidgetRow
            key={item.id}
            to={portalPaths.project(item.project_id, 'milestones')}
            title={item.name}
            subtitle={[decodeHtmlEntities(item.project_name), item.organization_name].filter(Boolean).join(' · ')}
            right={
              <StatusTag tone={item.is_late ? 'red' : 'gray'}>
                {formatPortalDate(item.target_date, i18n.language) ?? ''}
              </StatusTag>
            }
          />
        ))
      }
    </WidgetFrame>
  );
};

export const LatestDiscussionsWidget = ({ result, loading, onRetry }: WidgetProps<'latest_discussions'>) => {
  const { t, i18n } = useTranslation(OVERVIEW_NS);
  return (
    <WidgetFrame
      title={t('widgets.latest_discussions.title', { defaultValue: 'Latest discussions' })}
      viewAllTo={portalPaths.discussions}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      isEmpty={data => data.items.length === 0}
      emptyText={t('widgets.latest_discussions.empty', { defaultValue: 'No discussions yet.' })}
    >
      {({ items }) =>
        items.map(item => (
          <WidgetRow
            key={item.id}
            to={portalPaths.discussion(item.id)}
            unread={item.unread}
            title={`${item.organization_name} · ${item.context_label}`}
            subtitle={item.last_text}
            right={formatRelativeTime(item.last_at, i18n.language)}
          />
        ))
      }
    </WidgetFrame>
  );
};

export const MentionsMeWidget = ({ result, loading, onRetry }: WidgetProps<'mentions_me'>) => {
  const { t, i18n } = useTranslation(OVERVIEW_NS);
  return (
    <WidgetFrame
      title={t('widgets.mentions_me.title', { defaultValue: 'Mentions of me' })}
      viewAllTo={portalPaths.discussions}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      isEmpty={data => data.items.length === 0}
      emptyText={t('widgets.mentions_me.empty', { defaultValue: 'Nobody has mentioned you in a discussion.' })}
    >
      {({ items }) =>
        items.map(item => (
          <WidgetRow
            key={item.id}
            to={portalPaths.discussion(item.thread_id)}
            unread={item.unread}
            title={t('widgets.mentions_me.row', {
              name: item.author_name,
              project: decodeHtmlEntities(item.project_name),
              defaultValue: '{{name}} in {{project}}',
            })}
            subtitle={item.excerpt}
            right={formatRelativeTime(item.at, i18n.language)}
          />
        ))
      }
    </WidgetFrame>
  );
};

export const NeedsAttentionWidget = ({ result, loading, onRetry }: WidgetProps<'needs_attention'>) => {
  const { t, i18n } = useTranslation(OVERVIEW_NS);
  const KIND_LABELS = {
    approval_overdue: t('widgets.needs_attention.approval_overdue', { defaultValue: 'Overdue approval' }),
    change_request_review: t('widgets.needs_attention.change_request_review', {
      defaultValue: 'High-priority request to review',
    }),
    milestone_late: t('widgets.needs_attention.milestone_late', { defaultValue: 'Late milestone' }),
  };
  const targetPath = (target: { type: 'approval' | 'change_request' | 'project'; id: string }) =>
    target.type === 'approval'
      ? portalPaths.approval(target.id)
      : target.type === 'change_request'
        ? portalPaths.changeRequest(target.id)
        : portalPaths.project(target.id, 'milestones');

  return (
    <WidgetFrame
      title={t('widgets.needs_attention.title', { defaultValue: 'Needs attention' })}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      isEmpty={data => data.items.length === 0}
      emptyText={t('widgets.needs_attention.empty', { defaultValue: 'Nothing needs attention. Nice work.' })}
    >
      {({ items }) =>
        items.map(item => (
          <WidgetRow
            key={`${item.kind}-${item.target.id}`}
            to={targetPath(item.target)}
            title={item.label}
            subtitle={`${KIND_LABELS[item.kind]} · ${item.detail}`}
            right={formatPortalDate(item.at, i18n.language)}
          />
        ))
      }
    </WidgetFrame>
  );
};
