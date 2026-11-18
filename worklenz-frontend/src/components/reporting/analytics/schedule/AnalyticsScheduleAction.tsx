import React, { useState } from 'react';
import { Button, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { analyticsSchedulesApiService } from '@/api/reporting/analytics-schedules.api.service';
import { useAuthService } from '@/hooks/useAuth';
import logger from '@/utils/errorLogger';
import type { AnalyticsScheduleUpsertPayload } from '@/types/reporting/analytics-schedules.types';
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
  const [saving, setSaving] = useState(false);

  const timezone = session?.timezone_name || session?.timezone || 'UTC';
  const defaultRecipient = session?.email || null;

  // Always create a new schedule — multiple schedules per report (and project filters) are allowed.
  // Edit / remove existing schedules from the Scheduled reports hub.
  const handleSave = async (payload: AnalyticsScheduleUpsertPayload) => {
    try {
      setSaving(true);
      const res = await analyticsSchedulesApiService.upsertSchedule(payload);
      if (res.done && res.body) {
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

  return (
    <>
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        {t('actionSchedule', { defaultValue: 'Schedule' })}
      </Button>
      <ScheduleReportModal
        open={open}
        reportKind={reportKind}
        reportName={reportName}
        templateId={templateId}
        timezone={timezone}
        existing={null}
        confirmLoading={saving}
        defaultRecipient={defaultRecipient}
        getFilters={getFilters}
        onCancel={() => setOpen(false)}
        onSave={handleSave}
      />
    </>
  );
};
