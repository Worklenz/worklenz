import React from 'react';
import { Avatar, Button, Flex, Table, Tag, Tooltip, Typography, theme } from '@/shared/antd-imports';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import dayjs from 'dayjs';
import { AUDIT_EVENT_TYPE, AUDIT_LOG_I18N_NAMESPACE } from '@/shared/audit-log-constants';
import { IAuditLogEvent } from '@/types/admin-center/audit-log.types';
import { formatCalendarDate } from '@/utils/date-presets';
import { AUDIT_LOG_PAGE_SIZE_OPTIONS } from '@/features/admin-center/audit-log/audit-log-filters';
import {
  CATEGORY_TAG_COLOR,
  formatRelativeDay,
  getCategoryLabel,
  getEventLabel,
  getInitials,
} from './audit-log-display';

interface AuditLogTableProps {
  events: IAuditLogEvent[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  failed: boolean;
  hasActiveFilters: boolean;
  onPageChange: (page: number, pageSize: number) => void;
  onRetry: () => void;
  onClearFilters: () => void;
}

/**
 * Read-only by design (Audit log spec, task 7.9): the audit log is append-only, so rows have
 * no selection, no row actions and no edit/delete affordance of any kind.
 */
export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  events,
  total,
  page,
  pageSize,
  loading,
  failed,
  hasActiveFilters,
  onPageChange,
  onRetry,
  onClearFilters,
}) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);

  if (failed) {
    return <AuditLogErrorState onRetry={onRetry} />;
  }

  return (
    <Table<IAuditLogEvent>
      rowKey="id"
      size="middle"
      columns={buildColumns(t)}
      dataSource={events}
      loading={loading}
      scroll={{ x: 860 }}
      locale={{
        emptyText: loading ? ' ' : (
          <AuditLogEmptyState hasActiveFilters={hasActiveFilters} onClearFilters={onClearFilters} />
        ),
      }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: AUDIT_LOG_PAGE_SIZE_OPTIONS,
        hideOnSinglePage: total <= AUDIT_LOG_PAGE_SIZE_OPTIONS[0],
        showTotal: count => t('paginationTotal', { defaultValue: '{{count}} events', count }),
        onChange: onPageChange,
      }}
    />
  );
};

const buildColumns = (t: TFunction): TableColumnsType<IAuditLogEvent> => [
  {
    key: 'timestamp',
    title: t('columnTimestamp', { defaultValue: 'Timestamp' }),
    dataIndex: 'created_at',
    width: 170,
    render: (createdAt: string) => <TimestampCell t={t} createdAt={createdAt} />,
  },
  {
    key: 'actor',
    title: t('columnActor', { defaultValue: 'Actor' }),
    width: 200,
    render: (_, event) => <ActorCell t={t} event={event} />,
  },
  {
    key: 'category',
    title: t('columnCategory', { defaultValue: 'Category' }),
    dataIndex: 'category',
    width: 210,
    render: (category: IAuditLogEvent['category']) => (
      <Tag color={CATEGORY_TAG_COLOR[category]} bordered={false} style={{ borderRadius: 12, marginInlineEnd: 0 }}>
        {getCategoryLabel(t, category)}
      </Tag>
    ),
  },
  {
    key: 'event',
    title: t('columnEvent', { defaultValue: 'Event' }),
    dataIndex: 'event_type',
    width: 190,
    render: (eventType: string) => (
      <Flex align="center" gap={6} wrap="wrap">
        <Typography.Text strong>{getEventLabel(t, eventType)}</Typography.Text>
        {eventType === AUDIT_EVENT_TYPE.LOGIN_FAILED.id && (
          <Tag color="error" bordered={false} style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }}>
            {t('failedTag', { defaultValue: 'FAILED' })}
          </Tag>
        )}
      </Flex>
    ),
  },
  {
    key: 'details',
    title: t('columnDetails', { defaultValue: 'Details' }),
    render: (_, event) => <DetailsCell t={t} event={event} />,
  },
];

const TimestampCell: React.FC<{ t: TFunction; createdAt: string }> = ({ t, createdAt }) => {
  const date = dayjs(createdAt);
  return (
    <Tooltip title={date.toISOString()}>
      <div style={{ whiteSpace: 'nowrap' }}>
        <Typography.Text style={{ fontSize: 13 }}>
          {formatCalendarDate(date)} · {date.format('LT')}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
          {formatRelativeDay(t, createdAt)}
        </Typography.Text>
      </div>
    </Tooltip>
  );
};

const ActorCell: React.FC<{ t: TFunction; event: IAuditLogEvent }> = ({ t, event }) => {
  const isRemoved = !!event.actor_user_id && !event.actor_in_workspace;
  return (
    <Flex align="center" gap={8}>
      <Avatar size={24} style={{ flexShrink: 0, fontSize: 10 }}>
        {getInitials(event.actor_name)}
      </Avatar>
      <div style={{ minWidth: 0 }}>
        <Typography.Text strong ellipsis={{ tooltip: event.actor_name }} style={{ display: 'block' }}>
          {event.actor_name}
        </Typography.Text>
        {isRemoved && (
          <Typography.Text type="secondary" italic style={{ fontSize: 11 }}>
            {t('actorRemoved', { defaultValue: 'removed from workspace' })}
          </Typography.Text>
        )}
      </div>
    </Flex>
  );
};

const DetailsCell: React.FC<{ t: TFunction; event: IAuditLogEvent }> = ({ t, event }) => {
  const { token } = theme.useToken();
  const hasChange = event.old_value !== null || event.new_value !== null;
  const emptyValue = t('valueEmpty', { defaultValue: '(none)' });

  return (
    <div style={{ fontSize: 12, lineHeight: 1.45, maxWidth: 420 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {event.description}
      </Typography.Text>
      {hasChange && (
        <div aria-label={t('changeAria', { defaultValue: 'Changed from {{from}} to {{to}}', from: event.old_value ?? emptyValue, to: event.new_value ?? emptyValue })}>
          <Typography.Text delete style={{ color: token.colorError, opacity: 0.8, fontSize: 12 }}>
            {event.old_value ?? emptyValue}
          </Typography.Text>
          <span aria-hidden="true" style={{ margin: '0 6px', color: token.colorTextSecondary }}>
            →
          </span>
          <Typography.Text strong style={{ color: token.colorSuccess, fontSize: 12 }}>
            {event.new_value ?? emptyValue}
          </Typography.Text>
        </div>
      )}
    </div>
  );
};

const AuditLogEmptyState: React.FC<{ hasActiveFilters: boolean; onClearFilters: () => void }> = ({
  hasActiveFilters,
  onClearFilters,
}) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);
  const { token } = theme.useToken();
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: token.colorText }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {hasActiveFilters
          ? t('emptyFilteredTitle', { defaultValue: 'No events match the current filters' })
          : t('emptyTitle', { defaultValue: 'No audit events yet' })}
      </div>
      <p style={{ color: token.colorTextSecondary, fontSize: 12, margin: '0 0 16px' }}>
        {hasActiveFilters
          ? t('emptyFilteredHint', { defaultValue: 'Try a wider date range or clear some filters.' })
          : t('emptyHint', {
              defaultValue: 'Sign-ins, member and role changes, permission changes and project lifecycle events will appear here as they happen.',
            })}
      </p>
      {hasActiveFilters && (
        <Button size="small" onClick={onClearFilters}>
          {t('clearFilters', { defaultValue: 'Clear filters' })}
        </Button>
      )}
    </div>
  );
};

const AuditLogErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);
  const { token } = theme.useToken();
  return (
    <div role="alert" style={{ padding: '32px 16px', textAlign: 'center', color: token.colorText }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        {t('loadError', { defaultValue: "Couldn't load the audit log" })}
      </div>
      <Button type="primary" size="small" onClick={onRetry}>
        {t('retry', { defaultValue: 'Retry' })}
      </Button>
    </div>
  );
};
