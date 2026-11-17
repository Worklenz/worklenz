import React, { useCallback, useState } from 'react';
import { Button, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { analyticsSchedulesApiService } from '@/api/reporting/analytics-schedules.api.service';
import { useAuthService } from '@/hooks/useAuth';
import logger from '@/utils/errorLogger';
import type {
  AnalyticsReportSchedule,
  AnalyticsScheduleUpsertPayload,
} from '@/types/reporting/analytics-schedules.types';
import { ScheduleReportModal } from './ScheduleReportModal';

export interface AnalyticsScheduleActionProps {
  reportKind: string;
  reportName: string;
  templateId?: string | null;
  getFilters: () => Record<string, unknown>;
  disabled?: boolean;
}

export const AnalyticsScheduleAction: React.FC<AnalyticsScheduleActionProps> = ({
  reportKind,
  reportName,
  templateId = null,
  getFilters,
  disabled,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const authService = useAuthService();
  const session = authService.getCurrentSession();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<AnalyticsReportSchedule | null>(null);

  const timezone = session?.timezone_name || session?.timezone || 'UTC';
  const defaultRecipient = session?.email || null;

  const openModal = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await analyticsSchedulesApiService.getByReport(reportKind, templateId);
      if (res.done) {
        setExisting(res.body ?? null);
      } else {
        setExisting(null);
      }
    } catch (error) {
      logger.error('Failed to load report schedule', error);
      setExisting(null);
    } finally {
      setLoading(false);
    }
  }, [reportKind, templateId]);

  const handleSave = async (payload: AnalyticsScheduleUpsertPayload) => {
    try {
      setSaving(true);
      const res = await analyticsSchedulesApiService.upsertSchedule(payload);
      if (res.done && res.body) {
        setExisting(res.body);
        message.success(
          t('scheduleSaved', { defaultValue: 'Schedule saved' })
        );
        setOpen(false);
      } else {
        message.error(
          res.message ||
            t('scheduleSaveFailed', { defaultValue: 'Failed to save schedule' })
        );
      }
    } catch (error) {
      logger.error('Failed to save report schedule', error);
      message.error(t('scheduleSaveFailed', { defaultValue: 'Failed to save schedule' }));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!existing?.id) return;
    try {
      setSaving(true);
      const res = await analyticsSchedulesApiService.deleteSchedule(existing.id);
      if (res.done) {
        setExisting(null);
        message.success(
          t('scheduleRemoved', { defaultValue: 'Schedule removed' })
        );
        setOpen(false);
      } else {
        message.error(
          res.message ||
            t('scheduleRemoveFailed', { defaultValue: 'Failed to remove schedule' })
        );
      }
    } catch (error) {
      logger.error('Failed to remove report schedule', error);
      message.error(
        t('scheduleRemoveFailed', { defaultValue: 'Failed to remove schedule' })
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button disabled={disabled} loading={loading && open} onClick={() => void openModal()}>
        {t('actionSchedule', { defaultValue: 'Schedule' })}
      </Button>
      <ScheduleReportModal
        open={open}
        reportKind={reportKind}
        reportName={reportName}
        templateId={templateId}
        timezone={timezone}
        existing={existing}
        confirmLoading={saving || loading}
        defaultRecipient={defaultRecipient}
        getFilters={getFilters}
        onCancel={() => setOpen(false)}
        onSave={handleSave}
        onRemove={existing ? handleRemove : undefined}
      />
    </>
  );
};
