import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Empty,
  Flex,
  Space,
  Table,
  Tag,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analyticsSchedulesApiService } from '@/api/reporting/analytics-schedules.api.service';
import { useAuthService } from '@/hooks/useAuth';
import {
  analyticsPath,
  customReportPath,
} from '@/lib/reporting/analytics-nav';
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

export const ScheduledReportsHubPanel: React.FC = () => {
  const { t, i18n } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const authService = useAuthService();
  const session = authService.getCurrentSession();

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<AnalyticsReportSchedule[]>([]);
  const [editing, setEditing] = useState<AnalyticsReportSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  const timezone = session?.timezone_name || session?.timezone || 'UTC';
  const borderColor = token.colorBorderSecondary;
  const cardBg = token.colorBgContainer;

  const loadSchedules = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const handleSave = async (payload: AnalyticsScheduleUpsertPayload) => {
    try {
      setSaving(true);
      const res = await analyticsSchedulesApiService.upsertSchedule(payload);
      if (res.done) {
        message.success(t('scheduleSaved', { defaultValue: 'Schedule saved' }));
        setEditing(null);
        await loadSchedules();
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
        await loadSchedules();
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
      width: 220,
      render: (_, row) => (
        <Space wrap size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(reportOpenPath(row))}
          >
            {t('actionOpen', { defaultValue: 'Open' })}
          </Button>
          <Button type="link" size="small" onClick={() => setEditing(row)}>
            {t('scheduleEdit', { defaultValue: 'Edit schedule' })}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => void handleRemove(row)}
          >
            {t('scheduleRemove', { defaultValue: 'Remove schedule' })}
          </Button>
        </Space>
      ),
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
