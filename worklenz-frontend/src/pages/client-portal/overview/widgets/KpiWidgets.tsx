import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { portalPaths } from '@/pages/client-portal/portal-paths';
import { KpiFrame, OVERVIEW_NS, resolveStatus, type WidgetProps } from './WidgetFrame';

export const AwaitingApprovalsKpi = ({ result, loading, onRetry }: WidgetProps<'kpi_awaiting_approvals'>) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const navigate = useNavigate();
  return (
    <KpiFrame
      label={t('widgets.kpi_awaiting_approvals.title', { defaultValue: 'Pending approvals' })}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      to={portalPaths.approvals}
      onNavigate={navigate}
      render={({ awaiting, overdue }) => ({
        value: awaiting,
        tone: overdue > 0 ? 'warning' : 'default',
        sub: t('widgets.kpi_awaiting_approvals.sub', {
          count: overdue,
          defaultValue: '{{count}} overdue',
        }),
      })}
    />
  );
};

export const OpenChangeRequestsKpi = ({ result, loading, onRetry }: WidgetProps<'kpi_open_change_requests'>) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const navigate = useNavigate();
  return (
    <KpiFrame
      label={t('widgets.kpi_open_change_requests.title', { defaultValue: 'Change requests to review' })}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      to={portalPaths.changeRequests}
      onNavigate={navigate}
      render={({ needs_review, waiting_on_client }) => ({
        value: needs_review,
        tone: needs_review > 0 ? 'warning' : 'default',
        sub: t('widgets.kpi_open_change_requests.sub', {
          count: waiting_on_client,
          defaultValue: '{{count}} waiting on client',
        }),
      })}
    />
  );
};

export const DelayedMilestonesKpi = ({ result, loading, onRetry }: WidgetProps<'kpi_delayed_milestones'>) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const navigate = useNavigate();
  return (
    <KpiFrame
      label={t('widgets.kpi_delayed_milestones.title', { defaultValue: 'Delayed milestones' })}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      to={portalPaths.projects}
      onNavigate={navigate}
      render={({ delayed }) => ({
        value: delayed,
        tone: delayed > 0 ? 'danger' : 'success',
        sub: t('widgets.kpi_delayed_milestones.sub', { defaultValue: 'Across portal projects' }),
      })}
    />
  );
};

export const UnreadDiscussionsKpi = ({ result, loading, onRetry }: WidgetProps<'kpi_unread_discussions'>) => {
  const { t } = useTranslation(OVERVIEW_NS);
  const navigate = useNavigate();
  return (
    <KpiFrame
      label={t('widgets.kpi_unread_discussions.title', { defaultValue: 'Unread discussions' })}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      to={portalPaths.discussions}
      onNavigate={navigate}
      render={({ unread }) => ({
        value: unread,
        sub: t('widgets.kpi_unread_discussions.sub', { defaultValue: 'With new client messages' }),
      })}
    />
  );
};

export const OverdueInvoicesKpi = ({ result, loading, onRetry }: WidgetProps<'kpi_overdue_invoices'>) => {
  const { t, i18n } = useTranslation(OVERVIEW_NS);
  const navigate = useNavigate();
  return (
    <KpiFrame
      label={t('widgets.kpi_overdue_invoices.title', { defaultValue: 'Overdue invoices' })}
      status={resolveStatus(result, loading)}
      onRetry={onRetry}
      to={portalPaths.invoices}
      onNavigate={navigate}
      render={({ count, by_currency }) => ({
        value: count,
        tone: count > 0 ? 'danger' : 'success',
        sub:
          by_currency.length > 0
            ? by_currency
                .map(({ currency, amount }) => {
                  try {
                    return new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(amount);
                  } catch {
                    return `${amount} ${currency}`;
                  }
                })
                .join(' · ')
            : t('widgets.kpi_overdue_invoices.none', { defaultValue: 'Nothing overdue' }),
      })}
    />
  );
};
