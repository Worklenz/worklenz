import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  CrownOutlined,
  Dropdown,
  Empty,
  Flex,
  MoreOutlined,
  Result,
  Table,
  Tag,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import type { MenuProps, TableColumnsType } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analyticsSchedulesApiService } from '@/api/reporting/analytics-schedules.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import {
  analyticsPath,
  customReportPath,
} from '@/lib/reporting/analytics-nav';
import { stashScheduleFiltersForOpen } from '@/lib/reporting/analytics-schedule-open';
import { canUseFeature } from '@/utils/subscription-utils';
import logger from '@/utils/errorLogger';
import type {
  AnalyticsReportSchedule,
  AnalyticsScheduleUpsertPayload,
} from '@/types/reporting/analytics-schedules.types';
import { ScheduleReportModal } from './ScheduleReportModal';
import {
  formatScheduleCadence,
  formatScheduleNextSend,
} from './format-schedule-summary';

const { Text } = Typography;

function reportOpenPath(schedule: AnalyticsReportSchedule): string {
  if (schedule.template_id) {
    return analyticsPath(customReportPath(schedule.template_id));
  }
  return analyticsPath(schedule.report_kind);
}

function openScheduledReport(
  navigate: ReturnType<typeof useNavigate>,
  schedule: AnalyticsReportSchedule
): void {
  stashScheduleFiltersForOpen({
    reportKind: schedule.report_kind,
    templateId: schedule.template_id,
    filters: schedule.filters_json || {},
  });
  navigate(reportOpenPath(schedule));
}

export const ScheduledReportsHubPanel: React.FC = () => {
  const { t, i18n } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const canSchedule = canUseFeature(session, 'advanced_reporting');

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<AnalyticsReportSchedule[]>([]);
  const [editing, setEditing] = useState<AnalyticsReportSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  const timezone = session?.timezone_name || session?.timezone || 'UTC';
  const borderColor = token.colorBorderSecondary;
  const cardBg = token.colorBgContainer;

  const loadSchedules = useCallback(async (opts?: { silent?: boolean }) => {
    if (!canSchedule) {
      setSchedules([]);
      setLoading(false);
      return;
    }
    // Avoid full-table spinner on refresh when rows are already visible.
    if (!opts?.silent) {
      setLoading(true);
    }
    try {
      const res = await analyticsSchedulesApiService.listSchedules();
      if (res.done && Array.isArray(res.body)) {
        setSchedules(res.body);
      } else {
        setSchedules([]);
      }
    } catch (error) {
      logger.error('Failed to load scheduled reports', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [canSchedule]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  if (!canSchedule) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 360, width: '100%' }}>
        <Result
          icon={<CrownOutlined style={{ color: token.colorWarning }} />}
          title={t('businessReportLockedTitle', {
            defaultValue: 'Business plan required',
          })}
          subTitle={t('scheduleLockedDescription', {
            defaultValue:
              'Scheduled report emails are available on the Business plan.',
          })}
          extra={
            <Button
              type="primary"
              icon={<CrownOutlined />}
              onClick={() => dispatch(openUpgradeModal('default'))}
            >
              {t('upgradeToBusiness', { defaultValue: 'Upgrade to Business' })}
            </Button>
          }
        />
      </Flex>
    );
  }
  const handleSave = async (payload: AnalyticsScheduleUpsertPayload) => {
    if (!editing?.id) return;
    try {
      setSaving(true);
      // Hub always edits an existing row by id (POST creates a new schedule).
      const res = await analyticsSchedulesApiService.updateSchedule(editing.id, payload);
      if (res.done) {
        message.success(t('scheduleSaved', { defaultValue: 'Schedule saved' }));
        setEditing(null);
        await loadSchedules({ silent: true });
      } else {
        message.error(
          res.message || t('scheduleSaveFailed', { defaultValue: 'Failed to save schedule' })
        );
      }
    } catch (error) {
      logger.error('Failed to save schedule from hub', error);
      message.error(t('scheduleSaveFailed', { defaultValue: 'Failed to save schedule' }));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (schedule: AnalyticsReportSchedule) => {
    try {
      setSaving(true);
      const res = await analyticsSchedulesApiService.deleteSchedule(schedule.id);
      if (res.done) {
        message.success(t('scheduleRemoved', { defaultValue: 'Schedule removed' }));
        setEditing(null);
        await loadSchedules({ silent: true });
      } else {
        message.error(
          res.message ||
            t('scheduleRemoveFailed', { defaultValue: 'Failed to remove schedule' })
        );
      }
    } catch (error) {
      logger.error('Failed to remove schedule from hub', error);
      message.error(
        t('scheduleRemoveFailed', { defaultValue: 'Failed to remove schedule' })
      );
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumnsType<AnalyticsReportSchedule> = [
    {
      title: t('colName', { defaultValue: 'Name' }),
      dataIndex: 'report_name',
      key: 'report_name',
      render: (name: string, row) => (
        <Flex vertical gap={2}>
          <Text strong>{name}</Text>
          {row.paused ? (
            <Tag>{t('schedulePaused', { defaultValue: 'Paused' })}</Tag>
          ) : (
            <Tag color="success">{t('scheduleActive', { defaultValue: 'Active' })}</Tag>
          )}
        </Flex>
      ),
    },
    {
      title: t('scheduleFrequency', { defaultValue: 'Frequency' }),
      key: 'frequency',
      render: (_, row) => formatScheduleCadence(row),
    },
    {
      title: t('scheduleNextSend', { defaultValue: 'Next send' }),
      key: 'next_send',
      render: (_, row) => formatScheduleNextSend(row.next_send_at, i18n.language),
    },
    {
      title: t('scheduleRecipients', { defaultValue: 'Recipients' }),
      key: 'recipients',
      ellipsis: true,
      render: (_, row) => row.recipients.join(', ') || '—',
    },
    {
      title: t('scheduleFormat', { defaultValue: 'Format' }),
      dataIndex: 'format',
      key: 'format',
      width: 88,
    },
    {
      title: t('rowActions', { defaultValue: 'Actions' }),
      key: 'actions',
      width: 72,
      align: 'center',
      render: (_, row) => {
        const items: MenuProps['items'] = [
          {
            key: 'open',
            label: t('actionOpen', { defaultValue: 'Open' }),
            onClick: () => openScheduledReport(navigate, row),
          },
          {
            key: 'edit',
            label: t('scheduleEdit', { defaultValue: 'Edit schedule' }),
            onClick: () => setEditing(row),
          },
          { type: 'divider' },
          {
            key: 'remove',
            label: t('scheduleRemove', { defaultValue: 'Remove schedule' }),
            danger: true,
            onClick: () => void handleRemove(row),
          },
        ];

        return (
          <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={t('rowActionsMenuAria', {
                defaultValue: 'Actions for {{name}}',
                name: row.report_name,
              })}
            />
          </Dropdown>
        );
      },
    },
  ];

  if (!loading && schedules.length === 0) {
    return (
      <div className="all-reports-hub__empty" style={{ borderColor, background: cardBg }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <>
              <Text strong>
                {t('hubNoScheduledTitle', { defaultValue: 'No scheduled reports yet' })}
              </Text>
              <br />
              <Text type="secondary">
                {t('hubNoScheduledHint', {
                  defaultValue:
                    'Open any report and choose Schedule to email it on a recurring basis.',
                })}
              </Text>
            </>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="all-reports-hub__scheduled-table"
        style={{
          border: `1px solid ${borderColor}`,
          borderRadius: token.borderRadiusLG,
          background: cardBg,
          overflow: 'hidden',
        }}
      >
        <Table<AnalyticsReportSchedule>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={schedules}
          pagination={schedules.length > 10 ? { pageSize: 10 } : false}
          scroll={{ x: true }}
        />
      </div>

      {editing && (
        <ScheduleReportModal
          open={!!editing}
          reportKind={editing.report_kind}
          reportName={editing.report_name}
          templateId={editing.template_id}
          timezone={editing.timezone || timezone}
          existing={editing}
          confirmLoading={saving}
          defaultRecipient={session?.email}
          getFilters={() => editing.filters_json || {}}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
          onRemove={() => handleRemove(editing)}
        />
      )}
    </>
  );
};
