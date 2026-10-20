import React from 'react';
import { Alert, Button, Spin } from '@/shared/antd-imports';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { AUDIT_LOG_I18N_NAMESPACE } from '@/shared/audit-log-constants';
import { IAuditLogExportJob } from '@/types/admin-center/audit-log.types';
import { formatCalendarDate } from '@/utils/date-presets';

interface AuditLogExportStatusProps {
  job: IAuditLogExportJob;
  isPreparingDownload: boolean;
  onDownload: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Background-export banner: progress while queued/processing, then a download link or a retry. */
export const AuditLogExportStatus: React.FC<AuditLogExportStatusProps> = ({
  job,
  isPreparingDownload,
  onDownload,
  onRetry,
  onDismiss,
}) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);

  if (job.status === 'queued' || job.status === 'processing') {
    return (
      <Alert
        type="info"
        role="status"
        icon={<Spin size="small" />}
        showIcon
        message={t('exportPreparingTitle', { defaultValue: 'Preparing your CSV export…' })}
        description={t('exportPreparingDescription', {
          defaultValue: 'Large exports run in the background. You can leave this page — the download link will appear here when it is ready.',
        })}
      />
    );
  }

  if (job.status === 'ready' && job.can_download) {
    return (
      <Alert
        type="success"
        role="status"
        showIcon
        closable
        onClose={onDismiss}
        message={t('exportReadyTitle', {
          defaultValue: 'Your CSV export is ready ({{count}} events).',
          count: job.row_count ?? 0,
        })}
        description={
          job.expires_at
            ? t('exportReadyDescription', {
                defaultValue: 'The file is available until {{date}}.',
                date: formatCalendarDate(dayjs(job.expires_at)),
              })
            : undefined
        }
        action={
          <Button type="primary" size="small" icon={<DownloadOutlined />} loading={isPreparingDownload} onClick={onDownload}>
            {t('exportDownload', { defaultValue: 'Download CSV' })}
          </Button>
        }
      />
    );
  }

  if (job.status === 'failed') {
    return (
      <Alert
        type="error"
        role="alert"
        showIcon
        closable
        onClose={onDismiss}
        message={t('exportFailedTitle', { defaultValue: "The export couldn't be completed." })}
        action={
          <Button size="small" onClick={onRetry}>
            {t('exportTryAgain', { defaultValue: 'Try again' })}
          </Button>
        }
      />
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      closable
      onClose={onDismiss}
      message={t('exportExpired', { defaultValue: 'This export has expired. Start a new export to get a fresh file.' })}
    />
  );
};
