import React, { useState } from 'react';
import { Button, CalendarOutlined, CrownOutlined, Space, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { analyticsSchedulesApiService } from '@/api/reporting/analytics-schedules.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useOrganizationPermission } from '@/hooks/useOrganizationPermission';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { isFinanceAnalyticsReport } from '@/lib/reporting/analytics-nav';
import { ORGANIZATION_PERMISSIONS } from '@/types/admin-center/permission-schemes.types';
import { canUseFeature } from '@/utils/subscription-utils';
import logger from '@/utils/errorLogger';
import type { AnalyticsScheduleUpsertPayload } from '@/types/reporting/analytics-schedules.types';
import { ScheduleReportModal } from './ScheduleReportModal';
import '@/components/reporting/analytics/analytics-report-controls.css';

export interface AnalyticsScheduleActionProps {
  reportKind: string;
  reportName: string;
  templateId?: string | null;
  getFilters: () => Record<string, unknown>;
  disabled?: boolean;
}

/** Schedule report email — Business plan only; Free/Pro show crown and open upgrade. */
export const AnalyticsScheduleAction: React.FC<AnalyticsScheduleActionProps> = ({
  reportKind,
  reportName,
  templateId = null,
  getFilters,
  disabled,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const canSchedule = canUseFeature(session, 'advanced_reporting');
  const isFinanceReport = isFinanceAnalyticsReport(reportKind);
  const { hasPermission: canViewFinance, isLoading: isFinancePermissionLoading } =
    useOrganizationPermission(ORGANIZATION_PERMISSIONS.VIEW_FINANCE);
  const lacksFinancePermission = isFinanceReport && !canViewFinance;

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

  const handleClick = () => {
    if (!canSchedule) {
      dispatch(openUpgradeModal('default'));
      return;
    }
    if (lacksFinancePermission) {
      message.warning(
        t('hubFinancePermissionHint', {
          defaultValue: 'Requires View finance permission',
        })
      );
      return;
    }
    setOpen(true);
  };

  // Keep Free/Pro clickable so the upgrade modal can open; only lock when schedule is allowed.
  const isButtonDisabled = canSchedule
    ? !!disabled ||
      (isFinanceReport && isFinancePermissionLoading) ||
      lacksFinancePermission
    : false;

  return (
    <>
      <Button
        className="analytics-blue-action"
        icon={<CalendarOutlined />}
        disabled={isButtonDisabled}
        onClick={handleClick}
        aria-label={
          lacksFinancePermission
            ? t('hubFinanceLockedAria', {
                defaultValue: '{{name}} — View finance permission required',
                name: t('actionSchedule', { defaultValue: 'Schedule' }),
              })
            : canSchedule
              ? t('actionSchedule', { defaultValue: 'Schedule' })
              : t('scheduleUpgradeAria', {
                  defaultValue: 'Schedule — Business plan required',
                })
        }
      >
        <Space size={6}>
          <span>{t('actionSchedule', { defaultValue: 'Schedule' })}</span>
          {!canSchedule && (
            <CrownOutlined
              style={{ fontSize: 14, color: '#faad14' }}
              aria-hidden
            />
          )}
        </Space>
      </Button>
      {canSchedule && !lacksFinancePermission && (
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
      )}
    </>
  );
};
