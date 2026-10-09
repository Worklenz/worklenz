import React from 'react';
import { Card, Flex, Space, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  useGetAuditEventsQuery,
  useGetAuditLogRetentionQuery,
  useGetAuditSummaryQuery,
} from '@/api/admin-center/audit-log.api.service';
import {
  resetFilters,
  selectAuditLogState,
  setActorFilter,
  setCategoryFilter,
  setDateFilter,
  setPagination,
  setSearch,
} from '@/features/admin-center/audit-log/audit-log.slice';
import {
  hasActiveAuditLogFilters,
  toAuditLogQueryParams,
} from '@/features/admin-center/audit-log/audit-log-filters';
import { PRESET_LABELS } from '@/pages/reporting/time-sheets/components/time-logs/TimeLogsDatePresetPill';
import { AUDIT_LOG_I18N_NAMESPACE } from '@/shared/audit-log-constants';
import { AuditLogRetentionControl } from '@/components/admin-center/audit-log/AuditLogRetentionControl';
import { AuditLogStatCards } from '@/components/admin-center/audit-log/AuditLogStatCards';
import { AuditLogToolbar } from '@/components/admin-center/audit-log/AuditLogToolbar';
import { AuditLogTable } from '@/components/admin-center/audit-log/AuditLogTable';
import { AuditLogExportStatus } from '@/components/admin-center/audit-log/AuditLogExportStatus';
import { useAuditLogExport } from '@/components/admin-center/audit-log/useAuditLogExport';
import { formatRetentionMonths } from '@/components/admin-center/audit-log/audit-log-display';

/** Admin Center > Security > Audit Log (Audit log spec). Owner/Admin only — see the route guard. */
const AuditLogPage: React.FC = () => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);
  const { t: tReport } = useTranslation('time-report');
  const dispatch = useAppDispatch();
  const { filters, page, pageSize } = useAppSelector(selectAuditLogState);

  const queryParams = React.useMemo(() => toAuditLogQueryParams(filters), [filters]);
  const summaryParams = React.useMemo(
    () => toAuditLogQueryParams(filters, { includeCategories: false }),
    [filters]
  );

  const eventsQuery = useGetAuditEventsQuery({ ...queryParams, index: page, size: pageSize });
  const summaryQuery = useGetAuditSummaryQuery(summaryParams);
  const { data: retention } = useGetAuditLogRetentionQuery();
  const exportState = useAuditLogExport(t, queryParams);

  const presetLabel = PRESET_LABELS[filters.datePreset];
  const dateLabel = tReport(presetLabel.key, { defaultValue: presetLabel.defaultValue });

  return (
    <Flex vertical gap={20} style={{ width: '100%', minWidth: 0 }}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
        <div style={{ maxWidth: 680 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t('pageTitle', { defaultValue: 'Audit Log' })}
          </Typography.Title>
        </div>
        <AuditLogRetentionControl variant="pill" />
      </Flex>

      <AuditLogStatCards
        summary={summaryQuery.data}
        loading={summaryQuery.isFetching && !summaryQuery.data}
        dateLabel={dateLabel}
        retentionLabel={retention ? formatRetentionMonths(t, retention.retention_months) : undefined}
      />

      <Card styles={{ body: { padding: '18px 20px 8px' } }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <AuditLogToolbar
            filters={filters}
            summary={summaryQuery.data}
            onSearchChange={value => dispatch(setSearch(value))}
            onDateChange={(datePreset, customRange) => dispatch(setDateFilter({ datePreset, customRange }))}
            onCategoriesChange={categories => dispatch(setCategoryFilter(categories))}
            onActorsChange={actorUserIds => dispatch(setActorFilter(actorUserIds))}
            onExport={exportState.handleExport}
            isExporting={exportState.isExporting}
            isExportBlocked={exportState.isExportBlocked}
          />
          {exportState.job && (
            <AuditLogExportStatus
              job={exportState.job}
              isPreparingDownload={exportState.isPreparingDownload}
              onDownload={exportState.handleDownload}
              onRetry={exportState.handleExport}
              onDismiss={exportState.handleDismiss}
            />
          )}
          <AuditLogTable
            events={eventsQuery.data?.data ?? []}
            total={eventsQuery.data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            loading={eventsQuery.isFetching}
            failed={eventsQuery.isError}
            hasActiveFilters={hasActiveAuditLogFilters(filters)}
            onPageChange={(nextPage, nextPageSize) =>
              dispatch(setPagination({ page: nextPage, pageSize: nextPageSize }))
            }
            onRetry={() => eventsQuery.refetch()}
            onClearFilters={() => dispatch(resetFilters())}
          />
        </Space>
      </Card>
    </Flex>
  );
};

export default AuditLogPage;
